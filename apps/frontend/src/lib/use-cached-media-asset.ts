"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth-client";

export type MediaAssetLoadStatus = "idle" | "loading" | "loaded" | "error";

type CachedMediaAssetResult = {
  src: string | null;
  status: MediaAssetLoadStatus;
};

const mediaAssetUrlCache = new Map<string, string>();
const inflightMediaAssetRequests = new Map<string, Promise<string>>();
const failedMediaAssetIds = new Set<string>();

export function useCachedMediaAsset(assetId: string | null): CachedMediaAssetResult {
  const [state, setState] = useState<CachedMediaAssetResult>(() => getInitialState(assetId));

  useEffect(() => {
    if (!assetId) {
      setState({ src: null, status: "idle" });
      return;
    }

    const cachedUrl = mediaAssetUrlCache.get(assetId);
    if (cachedUrl) {
      setState({ src: cachedUrl, status: "loaded" });
      return;
    }

    if (failedMediaAssetIds.has(assetId)) {
      setState({ src: null, status: "error" });
      return;
    }

    let cancelled = false;
    setState({ src: null, status: "loading" });

    const request = getOrCreateMediaAssetRequest(assetId);
    void request
      .then((src) => {
        if (!cancelled) {
          setState({ src, status: "loaded" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ src: null, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return state;
}

function getInitialState(assetId: string | null): CachedMediaAssetResult {
  if (!assetId) return { src: null, status: "idle" };
  const cachedUrl = mediaAssetUrlCache.get(assetId);
  if (cachedUrl) return { src: cachedUrl, status: "loaded" };
  if (failedMediaAssetIds.has(assetId)) return { src: null, status: "error" };
  return { src: null, status: "loading" };
}

function getOrCreateMediaAssetRequest(assetId: string) {
  const existingRequest = inflightMediaAssetRequests.get(assetId);
  if (existingRequest) return existingRequest;

  const request = fetchMediaAsset(assetId)
    .then((src) => {
      mediaAssetUrlCache.set(assetId, src);
      failedMediaAssetIds.delete(assetId);
      return src;
    })
    .catch((error) => {
      failedMediaAssetIds.add(assetId);
      throw error;
    })
    .finally(() => {
      inflightMediaAssetRequests.delete(assetId);
    });

  inflightMediaAssetRequests.set(assetId, request);
  return request;
}

async function fetchMediaAsset(assetId: string) {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Missing access token");
  }

  const response = await fetch(`/api/v1/media-assets/${assetId}/content`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load media asset (${response.status})`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
