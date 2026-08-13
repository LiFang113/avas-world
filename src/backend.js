import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const backendMode = supabaseUrl && supabaseKey ? "supabase" : "local";
const supabase = backendMode === "supabase" ? createClient(supabaseUrl, supabaseKey) : null;

export const normalizeAccountName = name => (name || "").trim().toLowerCase();
export const createUserId = () => "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

const readLocalJson = key => {
  try {
    const value = window.localStorage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const writeLocalJson = (key, value) => {
  try {
    window.localStorage?.setItem(key, JSON.stringify(value));
  } catch {}
};

const accountToRow = account => ({
  id: account.id || account.userId,
  name: account.name,
  search_name: normalizeAccountName(account.name),
  age: account.age || null,
  avatar: account.avatar,
  color: account.color,
  updated_at: new Date().toISOString(),
});

const rowToAccount = row => ({
  id: row.id,
  userId: row.id,
  name: row.name,
  searchName: row.search_name,
  age: row.age,
  avatar: row.avatar,
  color: row.color,
});

const getLocalAccounts = () => readLocalJson("ava-accounts") || [];

const saveLocalAccount = account => {
  const nextAccount = { ...account, id: account.id || account.userId, searchName: normalizeAccountName(account.name), updatedAt: Date.now() };
  const accounts = getLocalAccounts();
  const idx = accounts.findIndex(a => a.id === nextAccount.id || ((a.searchName || normalizeAccountName(a.name)) === nextAccount.searchName && Number(a.age) === Number(nextAccount.age)));
  const next = idx >= 0 ? accounts.map((a, i) => i === idx ? { ...a, ...nextAccount } : a) : [...accounts, nextAccount];
  writeLocalJson("ava-accounts", next);
  return nextAccount;
};

export const saveAccount = async account => {
  const localAccount = saveLocalAccount(account);
  if (!supabase) return localAccount;
  const { error } = await supabase.from("ava_accounts").upsert(accountToRow(account));
  if (error) throw error;
  return localAccount;
};

export const findAccountByNameAge = async (name, age) => {
  const searchName = normalizeAccountName(name);
  const accountAge = Number(age) || null;
  if (!searchName || !accountAge) return null;

  if (supabase) {
    const { data, error } = await supabase
      .from("ava_accounts")
      .select("id,name,search_name,age,avatar,color")
      .eq("search_name", searchName)
      .eq("age", accountAge)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return data?.[0] ? rowToAccount(data[0]) : null;
  }

  const match = getLocalAccounts()
    .filter(a => (a.searchName || normalizeAccountName(a.name)) === searchName && Number(a.age) === accountAge)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return match || null;
};

export const searchAccounts = async (query, currentUserId, friendIds = []) => {
  const q = normalizeAccountName(query);
  if (!q) return [];
  const friendSet = new Set(friendIds);

  if (supabase) {
    const { data, error } = await supabase
      .from("ava_accounts")
      .select("id,name,search_name,age,avatar,color")
      .ilike("search_name", `%${q}%`)
      .neq("id", currentUserId)
      .limit(8);
    if (error) throw error;
    return (data || []).map(rowToAccount).filter(a => !friendSet.has(a.id));
  }

  return getLocalAccounts()
    .filter(a => a.id !== currentUserId && !friendSet.has(a.id) && (a.searchName || normalizeAccountName(a.name)).includes(q))
    .slice(0, 8);
};

export const resolveRecipientIds = async friends => {
  const ids = new Set(friends.map(friend => friend.id).filter(Boolean));
  if (!supabase) return [...ids];

  const names = [...new Set(friends.map(friend => normalizeAccountName(friend.name)).filter(Boolean))];
  if (names.length === 0) return [...ids];

  const { data, error } = await supabase
    .from("ava_accounts")
    .select("id,search_name")
    .in("search_name", names);
  if (error) return [...ids];
  (data || []).forEach(account => ids.add(account.id));
  return [...ids];
};

export const mergeFriendsByName = friends => {
  const seen = new Set();
  return friends.filter(friend => {
    const key = normalizeAccountName(friend.name) || friend.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const loadFriends = async userId => {
  if (!supabase) return null;
  const { data: links, error } = await supabase.from("ava_friendships").select("friend_id").eq("owner_id", userId);
  if (error) throw error;
  const friendIds = (links || []).map(link => link.friend_id);
  if (friendIds.length === 0) return [];
  const { data: accounts, error: accountError } = await supabase
    .from("ava_accounts")
    .select("id,name,search_name,age,avatar,color")
    .in("id", friendIds);
  if (accountError) throw accountError;
  return (accounts || []).map(rowToAccount);
};

export const saveFriends = async (userId, friends) => {
  if (!supabase) return;
  const { error: deleteError } = await supabase.from("ava_friendships").delete().eq("owner_id", userId);
  if (deleteError) throw deleteError;
  if (friends.length === 0) return;
  const rows = friends.map(friend => ({ owner_id: userId, friend_id: friend.id }));
  const { error } = await supabase.from("ava_friendships").insert(rows);
  if (error) throw error;
};

export const loadUserData = async userId => {
  if (!userId) return null;
  if (!supabase) return readLocalJson(`ava-world-data-${userId}`) || readLocalJson("ava-world-data");

  const { data, error } = await supabase
    .from("ava_user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.data || null;
};

export const saveUserData = async (userId, data) => {
  if (!userId) return;
  writeLocalJson(`ava-world-data-${userId}`, data);
  if (!supabase) return;

  const { error } = await supabase.from("ava_user_data").upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

const rowToMessage = row => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  avatar: row.avatar,
  color: row.color,
  text: row.text,
  time: Number(row.sent_at_ms),
  recipientIds: row.recipient_ids || [],
});

export const loadChatMessages = async userId => {
  if (supabase) {
    const { data, error } = await supabase
      .from("ava_messages")
      .select("id,user_id,name,avatar,color,text,sent_at_ms,recipient_ids")
      .order("sent_at_ms", { ascending: false })
      .limit(150);
    if (error) throw error;
    return (data || []).map(rowToMessage).reverse().filter(msg => msg.userId === userId || (msg.recipientIds || []).includes(userId));
  }

  const local = readLocalJson("chatroom-messages") || { messages: [] };
  return local.messages || [];
};

export const sendChatMessage = async msg => {
  if (supabase) {
    const { error } = await supabase.from("ava_messages").insert({
      id: msg.id,
      user_id: msg.userId,
      name: msg.name,
      avatar: msg.avatar,
      color: msg.color,
      text: msg.text,
      sent_at_ms: msg.time,
      recipient_ids: msg.recipientIds || [],
    });
    if (error) throw error;
    return;
  }

  const local = readLocalJson("chatroom-messages") || { messages: [] };
  local.messages = [...(local.messages || []), msg].slice(-100);
  writeLocalJson("chatroom-messages", local);
};

export const updatePresence = async account => {
  if (!supabase) return [];
  const now = Date.now();
  const { error } = await supabase.from("ava_presence").upsert({
    user_id: account.userId,
    name: account.name,
    avatar: account.avatar,
    color: account.color,
    last_seen_ms: now,
  });
  if (error) throw error;

  const { data, error: readError } = await supabase
    .from("ava_presence")
    .select("user_id,name,avatar,color,last_seen_ms")
    .gt("last_seen_ms", now - 30000);
  if (readError) throw readError;
  return (data || []).map(row => ({ id: row.user_id, name: row.name, avatar: row.avatar, color: row.color, lastSeen: Number(row.last_seen_ms) }));
};
