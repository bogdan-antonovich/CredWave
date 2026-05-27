import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { api } from "@/services/api";
import { identifyUser, resetUser } from "@/services/analytics";
import { config } from "@/config/env";

interface ApiUser {
  id: number;
  email: string;
  name: string;
  picture_url: string;
  google_connected: boolean;
}

interface ApiRestaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  ownerName: string | null;
  additionalInfo: string | null;
  googlePlaceId: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googlePhotoUrl: string | null;
  googleDescription: string | null;
  restaurantChangedAt: string | null;
  updatedAt: string;
}

interface ApiAutoReply {
  enabled: boolean;
  defaultTone: "empathetic" | "professional" | "casual";
  customInstructions: string;
}

export const useUserStore = defineStore("user", () => {
  const loading = ref(false);
  const restaurantId = ref<string | null>(null);
  const googleConnected = ref(true);
  const id = ref<number | null>(null);

  const profile = ref({
    email: "",
    name: "",
    pictureUrl: "",
  });

  const restaurant = ref({
    name: "",
    ownerName: "",
    additionalInfo: "",
    googlePlaceId: null as string | null,
    googleRating: null as number | null,
    googleReviewCount: null as number | null,
    googlePhotoUrl: null as string | null,
    googleDescription: null as string | null,
    restaurantChangedAt: null as string | null,
  });

  const changingRestaurant = ref(false);

  const canChangeRestaurant = computed(() => {
    const changedAt = restaurant.value.restaurantChangedAt;
    if (!changedAt) return true;
    return Date.now() - new Date(changedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  });

  const daysUntilCanChange = computed(() => {
    const changedAt = restaurant.value.restaurantChangedAt;
    if (!changedAt) return 0;
    const ms = 7 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(changedAt).getTime());
    return Math.max(1, Math.ceil(ms / 86_400_000));
  });

  const autoReply = ref<ApiAutoReply>({
    enabled: false,
    defaultTone: "professional",
    customInstructions: "",
  });

  async function fetchAll() {
    loading.value = true;
    try {
      const user = await api.get<ApiUser>("/users/me");
      profile.value.email = user.email;
      profile.value.name = user.name;
      profile.value.pictureUrl = user.picture_url;
      googleConnected.value = user.google_connected;
      id.value = user.id;
      identifyUser(String(user.id), { email: user.email, name: user.name });
    } catch {
      loading.value = false;
      return;
    }

    try {
      const data = await api.get<{ restaurants: ApiRestaurant[] }>(
        "/restaurants",
      );
      const restaurants = data.restaurants ?? [];

      if (restaurants.length > 0) {
        const r = restaurants[0];
        restaurantId.value = r.id;
        restaurant.value.name = r.name ?? "";
        restaurant.value.ownerName = r.ownerName ?? "";
        restaurant.value.additionalInfo = r.additionalInfo ?? "";
        restaurant.value.googlePlaceId = r.googlePlaceId ?? null;
        restaurant.value.googleRating = r.googleRating ?? null;
        restaurant.value.googleReviewCount = r.googleReviewCount ?? null;
        restaurant.value.googlePhotoUrl = r.googlePhotoUrl ?? null;
        restaurant.value.googleDescription = r.googleDescription ?? null;
        restaurant.value.restaurantChangedAt = r.restaurantChangedAt ?? null;

        const ar = await api.get<ApiAutoReply>(
          `/restaurants/${r.id}/auto-reply`,
        );
        autoReply.value.enabled = ar.enabled ?? false;
        autoReply.value.defaultTone = ar.defaultTone ?? "professional";
        autoReply.value.customInstructions = ar.customInstructions ?? "";
      }
    } catch {
      // Restaurant fetch failed (e.g. Google API error) — profile is still set
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings() {
    if (!restaurantId.value) throw new Error("Restaurant not loaded");

    await Promise.all([
      api.patch(`/restaurants/${restaurantId.value}`, {
        name: restaurant.value.name,
        ownerName: restaurant.value.ownerName,
        additionalInfo: restaurant.value.additionalInfo,
      }),
      api.patch(`/restaurants/${restaurantId.value}/auto-reply`, {
        enabled: autoReply.value.enabled,
        defaultTone: autoReply.value.defaultTone,
        customInstructions: autoReply.value.customInstructions,
      }),
    ]);
  }

  function setAutoReplyEnabled(val: boolean) {
    autoReply.value.enabled = val;
  }

  function setAutoReplyTone(tone: "empathetic" | "professional" | "casual") {
    autoReply.value.defaultTone = tone;
  }

  async function createRestaurant(
    placeId: string,
    name: string,
    address: string | null,
  ) {
    const r = await api.post<ApiRestaurant>("/restaurants", {
      placeId,
      name,
      address,
    });
    restaurantId.value = r.id;
    restaurant.value.name = r.name ?? "";
    restaurant.value.ownerName = r.ownerName ?? "";
    restaurant.value.additionalInfo = r.additionalInfo ?? "";
    restaurant.value.googlePlaceId = r.googlePlaceId ?? null;
    restaurant.value.googleRating = r.googleRating ?? null;
    restaurant.value.googleReviewCount = r.googleReviewCount ?? null;
    restaurant.value.googlePhotoUrl = r.googlePhotoUrl ?? null;
    restaurant.value.googleDescription = r.googleDescription ?? null;
    restaurant.value.restaurantChangedAt = r.restaurantChangedAt ?? null;
  }

  async function switchRestaurant(
    placeId: string,
    name: string,
    address: string | null,
  ) {
    if (!restaurantId.value) throw new Error("No restaurant to switch");
    const r = await api.post<ApiRestaurant>(
      `/restaurants/${restaurantId.value}/switch`,
      { placeId, name, address },
    );
    restaurant.value.name = r.name ?? "";
    restaurant.value.ownerName = r.ownerName ?? "";
    restaurant.value.additionalInfo = r.additionalInfo ?? "";
    restaurant.value.googlePlaceId = r.googlePlaceId ?? null;
    restaurant.value.googleRating = r.googleRating ?? null;
    restaurant.value.googleReviewCount = r.googleReviewCount ?? null;
    restaurant.value.googlePhotoUrl = r.googlePhotoUrl ?? null;
    restaurant.value.googleDescription = r.googleDescription ?? null;
    restaurant.value.restaurantChangedAt = r.restaurantChangedAt ?? null;
    changingRestaurant.value = false;
  }

  async function disconnectGoogle() {
    await api.del("/users/me/google");
    googleConnected.value = false;
  }

  async function deleteAccount() {
    await api.del("/users/me");
    resetUser();
    localStorage.removeItem("cw_access_token");
    localStorage.removeItem("cw_refresh_token");
    // Wipe in-memory state so nothing flashes before navigation
    id.value = null;
    restaurantId.value = null;
    googleConnected.value = false;
    profile.value = { email: "", name: "", pictureUrl: "" };
    restaurant.value = {
      name: "",
      ownerName: "",
      additionalInfo: "",
      googlePlaceId: null,
      googleRating: null,
      googleReviewCount: null,
      googlePhotoUrl: null,
      googleDescription: null,
      restaurantChangedAt: null,
    };
    autoReply.value = { enabled: false, defaultTone: "professional", customInstructions: "" };
    window.location.href = config.appUrl;
  }

  return {
    loading,
    id,
    restaurantId,
    googleConnected,
    profile,
    restaurant,
    autoReply,
    changingRestaurant,
    canChangeRestaurant,
    daysUntilCanChange,
    fetchAll,
    saveSettings,
    setAutoReplyEnabled,
    setAutoReplyTone,
    createRestaurant,
    switchRestaurant,
    disconnectGoogle,
    deleteAccount,
  };
});
