import type { FollowRequest, FollowStatus, FriendProfile, ProfileVisibility } from "@mlb-attendance/domain";
import { getSupabaseEnv, supabase } from "../persistence/supabaseClient";
import type { SocialGraphService } from "./socialGraphService";

type PublicProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string;
  favorite_team_id: string | null;
  avatar_url: string | null;
  profile_visibility: ProfileVisibility;
  shared_games_logged: number | null;
  shared_stadiums_visited: number | null;
  relationship_status: FollowStatus | null;
};

type PendingFollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
  username: string | null;
  display_name: string;
  favorite_team_id: string | null;
  avatar_url: string | null;
  profile_visibility: ProfileVisibility;
  shared_games_logged: number | null;
  shared_stadiums_visited: number | null;
};

function requireSupabaseClient() {
  const env = getSupabaseEnv();
  if (!env.isConfigured || !supabase) {
    throw new Error("Hosted social features are enabled but Supabase env vars are missing.");
  }

  return supabase;
}

function isHostedSocialUnavailable(message: string) {
  const normalized = message.toLowerCase();
  return [
    "profiles.username",
    "profiles.avatar_url",
    "profiles.profile_visibility",
    "shared_games_logged",
    "shared_stadiums_visited",
    "'username' column",
    "'avatar_url' column",
    "'profile_visibility' column",
    "'shared_games_logged' column",
    "'shared_stadiums_visited' column",
    "function public.search_profiles",
    "function public.get_following_profiles",
    "function public.get_follower_profiles",
    "function public.get_pending_follow_requests",
    "function public.get_friend_profile",
    "relation \"user_follows\" does not exist",
    "schema cache"
  ].some((pattern) => normalized.includes(pattern));
}

async function requireAuthenticatedUserId() {
  const client = requireSupabaseClient();
  const {
    data: { session },
    error
  } = await client.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.user?.id) {
    throw new Error("Sign in again to manage follow relationships.");
  }

  return session.user.id;
}

function mapProfileRow(row: PublicProfileRow): FriendProfile {
  return {
    id: row.user_id,
    username: row.username ?? undefined,
    displayName: row.display_name,
    favoriteTeamId: row.favorite_team_id ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    profileVisibility: row.profile_visibility,
    sharedGamesLogged: row.shared_games_logged ?? null,
    sharedStadiumsVisited: row.shared_stadiums_visited ?? null,
    relationshipStatus: row.relationship_status ?? "not_following"
  };
}

function mapPendingFollowRow(row: PendingFollowRow, currentUserId: string): FollowRequest {
  return {
    id: row.id,
    followerId: row.follower_id,
    followingId: row.following_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    direction: row.following_id === currentUserId ? "incoming" : "outgoing",
    profile: {
      id: row.user_id,
      username: row.username ?? undefined,
      displayName: row.display_name,
      favoriteTeamId: row.favorite_team_id ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      profileVisibility: row.profile_visibility,
      sharedGamesLogged: row.shared_games_logged ?? null,
      sharedStadiumsVisited: row.shared_stadiums_visited ?? null,
      relationshipStatus: row.status
    }
  };
}

export const hostedSocialGraphService: SocialGraphService = {
  kind: "hosted",
  async searchProfiles(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();
    const { data, error } = await client.rpc("search_profiles", {
      search_query: params.query.trim() || null
    });

    if (error) {
      if (isHostedSocialUnavailable(error.message)) {
        return [];
      }
      throw new Error(error.message);
    }

    return ((data ?? []) as PublicProfileRow[])
      .filter((row) => row.user_id !== currentUserId)
      .map(mapProfileRow);
  },
  async getFollowing() {
    const client = requireSupabaseClient();
    const { data, error } = await client.rpc("get_following_profiles");

    if (error) {
      if (isHostedSocialUnavailable(error.message)) {
        return [];
      }
      throw new Error(error.message);
    }

    return ((data ?? []) as PublicProfileRow[]).map(mapProfileRow);
  },
  async getFollowers() {
    const client = requireSupabaseClient();
    const { data, error } = await client.rpc("get_follower_profiles");

    if (error) {
      if (isHostedSocialUnavailable(error.message)) {
        return [];
      }
      throw new Error(error.message);
    }

    return ((data ?? []) as PublicProfileRow[]).map(mapProfileRow);
  },
  async getPendingFollowRequests(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();
    const { data, error } = await client.rpc("get_pending_follow_requests");

    if (error) {
      if (isHostedSocialUnavailable(error.message)) {
        return [];
      }
      throw new Error(error.message);
    }

    return ((data ?? []) as PendingFollowRow[]).map((row) => mapPendingFollowRow(row, currentUserId));
  },
  async requestFollow(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();

    if (currentUserId !== params.currentUserId) {
      throw new Error("Your account context is out of date. Refresh and try again.");
    }

    if (params.currentUserId === params.targetUserId) {
      throw new Error("You cannot follow yourself.");
    }

    const { data: existing, error: existingError } = await client
      .from("user_follows")
      .select("id, status")
      .eq("follower_id", params.currentUserId)
      .eq("following_id", params.targetUserId)
      .maybeSingle<{ id: string; status: FollowStatus }>();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing?.status === "accepted") {
      return;
    }

    if (existing?.status === "pending") {
      return;
    }

    if (existing?.status === "blocked") {
      throw new Error("That profile is not available for new follow requests right now.");
    }

    if (existing?.id) {
      const { error: deleteError } = await client.from("user_follows").delete().eq("id", existing.id);
      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    const { error } = await client.from("user_follows").insert({
      follower_id: params.currentUserId,
      following_id: params.targetUserId,
      status: "pending"
    });

    if (error) {
      throw new Error(error.message);
    }
  },
  async acceptFollowRequest(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();

    if (currentUserId !== params.currentUserId) {
      throw new Error("Your account context is out of date. Refresh and try again.");
    }

    const { error } = await client
      .from("user_follows")
      .update({ status: "accepted" })
      .eq("id", params.requestId)
      .eq("following_id", params.currentUserId)
      .eq("status", "pending");

    if (error) {
      throw new Error(error.message);
    }
  },
  async rejectFollowRequest(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();

    if (currentUserId !== params.currentUserId) {
      throw new Error("Your account context is out of date. Refresh and try again.");
    }

    const { error } = await client
      .from("user_follows")
      .update({ status: "rejected" })
      .eq("id", params.requestId)
      .eq("following_id", params.currentUserId)
      .eq("status", "pending");

    if (error) {
      throw new Error(error.message);
    }
  },
  async unfollowUser(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();

    if (currentUserId !== params.currentUserId) {
      throw new Error("Your account context is out of date. Refresh and try again.");
    }

    const { error } = await client
      .from("user_follows")
      .delete()
      .eq("follower_id", params.currentUserId)
      .eq("following_id", params.targetUserId);

    if (error) {
      throw new Error(error.message);
    }
  },
  async getFriendProfile(params) {
    const client = requireSupabaseClient();
    const currentUserId = await requireAuthenticatedUserId();

    if (currentUserId !== params.currentUserId) {
      throw new Error("Your account context is out of date. Refresh and try again.");
    }

    const { data, error } = await client.rpc("get_friend_profile", {
      target_user_id: params.targetUserId
    });

    if (error) {
      if (isHostedSocialUnavailable(error.message)) {
        return null;
      }
      throw new Error(error.message);
    }

    const row = Array.isArray(data) ? data[0] : null;
    return row ? mapProfileRow(row as PublicProfileRow) : null;
  }
};
