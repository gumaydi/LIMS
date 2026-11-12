export type Role = "ADMIN" | "STAFF";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
};

export type Item = {
  id: string;
  code: string;
  name: string;
  category: string;
  total_stock: number;
  available_stock: number;
  image_path: string | null;
  is_archived: boolean;
  created_at: string;
};

export type Borrowing = {
  id: string;
  borrower_name: string;
  item_id: string;
  item_code_snapshot: string;
  item_name_snapshot: string;
  item_category_snapshot: string;
  quantity: number;
  borrowed_on: string;
  status: "BORROWED" | "RETURNED";
  created_by: string;
  created_by_username_snapshot: string;
  created_at: string;
  returned_at: string | null;
  returner_name: string | null;
  returned_by: string | null;
  returned_by_username_snapshot: string | null;
};

export type Activity = {
  id: number;
  actor_id: string;
  actor_role_snapshot: Role;
  actor_username_snapshot: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
