"use client";

import React, { useCallback, useEffect, useRef } from "react";

export interface VideoDimensions {
  width: number;
  height: number;
}

interface WebRTCPlayerProps {
  url: string;
  className?: string;
  onVideoDimensionsChange?: (dimensions: VideoDimensions | null) => void;
}

type OfferData = {
  iceUfrag: string;
  icePwd: string;
  medias: string[];
};

function parseOffer(sdp: string): OfferData {
  const offerData: OfferData = {
    iceUfrag: "",
    icePwd: "",
    medias: [],
  };

  for (const line of sdp.split("\r\n")) {
    if (line.startsWith("m=")) {
      offerData.medias.push(line.slice("m=".length));
    } else if (!offerData.iceUfrag && line.startsWith("a=ice-ufrag:")) {
      offerData.iceUfrag = line.slice("a=ice-ufrag:".length);
    } else if (!offerData.icePwd && line.startsWith("a=ice-pwd:")) {
      offerData.icePwd = line.slice("a=ice-pwd:".length);
    }
  }

  return offerData;
}

function generateSdpFragment(offerData: OfferData, candidates: RTCIceCandidate[]) {
  const candidatesByMedia = new Map<number, RTCIceCandidate[]>();

  for (const candidate of candidates) {
    const mid = candidate.sdpMLineIndex;
    if (mid === null) continue;

    const mediaCandidates = candidatesByMedia.get(mid) ?? [];
    mediaCandidates.push(candidate);
    candidatesByMedia.set(mid, mediaCandidates);
  }

  let fragment = `a=ice-ufrag:${offerData.iceUfrag}\r\n`
    + `a=ice-pwd:${offerData.icePwd}\r\n`;

  offerData.medias.forEach((media, mid) => {
    const mediaCandidates = candidatesByMedia.get(mid);
    if (!mediaCandidates) return;

    fragment += `m=${media}\r\n`
      + `a=mid:${mid}\r\n`;

    for (const candidate of mediaCandidates) {
      fragment += `a=${candidate.candidate}\r\n`;
    }
  });

  return fragment;
}

function parseIceServers(linkHeader: string | null): RTCIceServer[] {
  if (!linkHeader) return [];

  return linkHeader.split(", ").map((link) => {
    const match = link.match(/^<(.+?)>; rel="ice-server"(; username="(.*?)"; credential="(.*?)"; credential-type="password")?/i);
    if (!match) return null;

    const server: RTCIceServer = {
      urls: [match[1]],
    };

    if (match[3] !== undefined && match[4] !== undefined) {
      server.username = JSON.parse(`"${match[3]}"`);
      server.credential = JSON.parse(`"${match[4]}"`);
    }

    return server;
  }).filter((server): server is RTCIceServer => server !== null);
}

async function sendLocalCandidates(sessionUrl: string, offerData: OfferData, candidates: RTCIceCandidate[]) {
  if (candidates.length === 0) return;

  const response = await fetch(sessionUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/trickle-ice-sdpfrag",
      "If-Match": "*",
    },
    body: generateSdpFragment(offerData, candidates),
  });

  if (!response.ok) {
    throw new Error(`WebRTC ICE candidate PATCH failed (${response.status})`);
  }
}

export function WebRTCPlayer({ url, className, onVideoDimensionsChange }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionUrlRef = useRef<string | null>(null);

  const updateDimensions = useCallback(() => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const renderedWidth = videoRef.current.clientWidth || videoRef.current.videoWidth;
      const renderedHeight = videoRef.current.clientHeight || videoRef.current.videoHeight;
      onVideoDimensionsChange?.({
        width: renderedWidth,
        height: renderedHeight,
      });
    } else {
      onVideoDimensionsChange?.(null);
    }
  }, [onVideoDimensionsChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function start() {
      try {
        const iceResponse = await fetch(url, { method: "OPTIONS" });
        const iceServers = parseIceServers(iceResponse.headers.get("Link"));
        const queuedCandidates: RTCIceCandidate[] = [];
        let offerData: OfferData | null = null;

        const pc = new window.RTCPeerConnection({
          iceServers,
        });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.createDataChannel("");

        pc.ontrack = (event: RTCTrackEvent) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            void videoRef.current.play().catch(() => {});
          }
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate || !offerData) return;

          const sessionUrl = sessionUrlRef.current;
          if (!sessionUrl) {
            queuedCandidates.push(event.candidate);
            return;
          }

          void sendLocalCandidates(sessionUrl, offerData, [event.candidate]).catch((err) => {
            console.error("WebRTC ICE candidate error:", err);
          });
        };

        const offer = await pc.createOffer();
        if (!offer.sdp) throw new Error("WebRTC offer SDP missing");
        offerData = parseOffer(offer.sdp);
        await pc.setLocalDescription(offer);

        const response = await fetch(url, {
          method: "POST",
          body: offer.sdp,
          headers: { "Content-Type": "application/sdp" },
        });

        if (!response.ok) throw new Error("WebRTC signaling failed");

        const location = response.headers.get("Location");
        if (!location) throw new Error("WebRTC session location missing");
        sessionUrlRef.current = new URL(location, url).toString();

        const answerSdp = await response.text();
        if (isMounted) {
          await pc.setRemoteDescription({
            type: "answer",
            sdp: answerSdp,
          });

          await sendLocalCandidates(sessionUrlRef.current, offerData, queuedCandidates);
          queuedCandidates.length = 0;
        }
      } catch (err) {
        console.error("WebRTC Playback Error:", err);
      }
    }

    start();

    return () => {
      isMounted = false;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (sessionUrlRef.current) {
        void fetch(sessionUrlRef.current, { method: "DELETE" }).catch(() => {});
        sessionUrlRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => updateDimensions();
    const handleResize = () => updateDimensions();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => updateDimensions())
      : null;

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("resize", handleResize);
    resizeObserver?.observe(video);
    updateDimensions();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [updateDimensions]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`h-full w-full object-contain ${className ?? ""}`}
    />
  );
}
