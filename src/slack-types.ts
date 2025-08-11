// Slack API関連の型定義

export interface Channel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  created?: number;
  is_archived?: boolean;
  is_general?: boolean;
  name_normalized?: string;
  is_shared?: boolean;
  is_org_shared?: boolean;
  is_member?: boolean;
  is_ext_shared?: boolean;
  is_pending_ext_shared?: boolean;
  pending_shared?: any[];
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

export interface Message {
  type: string;
  subtype?: string;
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  attachments?: Attachment[];
  blocks?: Block[];
  reactions?: Reaction[];
  files?: File[];
  edited?: {
    user: string;
    ts: string;
  };
}

export interface Attachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: AttachmentField[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

export interface AttachmentField {
  title: string;
  value: string;
  short?: boolean;
}

export interface Block {
  type: string;
  block_id?: string;
  elements?: any[];
  text?: any;
  accessory?: any;
  fields?: any[];
  image_url?: string;
  alt_text?: string;
}

export interface Reaction {
  name: string;
  users: string[];
  count: number;
}

export interface File {
  id: string;
  created: number;
  timestamp: number;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  pretty_type?: string;
  user?: string;
  editable?: boolean;
  size?: number;
  mode?: string;
  is_external?: boolean;
  external_type?: string;
  is_public?: boolean;
  public_url_shared?: boolean;
  display_as_bot?: boolean;
  username?: string;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
  permalink_public?: string;
  preview?: string;
  lines?: number;
  lines_more?: number;
  preview_is_truncated?: boolean;
  has_rich_preview?: boolean;
}

export interface User {
  id: string;
  team_id?: string;
  name?: string;
  deleted?: boolean;
  color?: string;
  real_name?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  profile?: UserProfile;
  is_admin?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  updated?: number;
  has_2fa?: boolean;
}

export interface UserProfile {
  title?: string;
  phone?: string;
  skype?: string;
  real_name?: string;
  real_name_normalized?: string;
  display_name?: string;
  display_name_normalized?: string;
  fields?: Record<string, any>;
  status_text?: string;
  status_emoji?: string;
  status_expiration?: number;
  avatar_hash?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  status_text_canonical?: string;
  team?: string;
}

// API Request/Response types
export interface ListChannelsOptions {
  types?: string;
  exclude_archived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface HistoryOptions {
  latest?: string;
  oldest?: string;
  inclusive?: boolean;
  limit?: number;
  cursor?: string;
}

export interface SlackAPIResponse {
  ok: boolean;
  error?: string;
  warning?: string;
  response_metadata?: {
    next_cursor?: string;
    messages?: string[];
    warnings?: string[];
  };
}

export interface ChannelsListResponse extends SlackAPIResponse {
  channels: Channel[];
}

export interface ConversationsHistoryResponse extends SlackAPIResponse {
  messages: Message[];
  has_more?: boolean;
  pin_count?: number;
}

export interface ConversationsRepliesResponse extends SlackAPIResponse {
  messages: Message[];
}
