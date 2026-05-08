"use client";

import React, { useCallback, useEffect, useRef } from 'react';

export interface VideoDimensions {
  width: number;
  height: number;
}

interface WebRTCPlayerProps {
  url: string;
  className?: string;
  onVideoDimensionsChange?: (dimensions: VideoDimensions | null) => void;
}

export function WebRTCPlayer({ url, className, onVideoDimensionsChange }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const updateDimensions = useCallback(() => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      onVideoDimensionsChange?.({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
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
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const response = await fetch(url, {
          method: 'POST',
          body: pc.localDescription?.sdp,
          headers: { 'Content-Type': 'application/sdp' }
        });

        if (!response.ok) throw new Error('WebRTC signaling failed');

        const answerSdp = await response.text();
        if (isMounted) {
          await pc.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp,
          });
        }
      } catch (err) {
        console.error('WebRTC Playback Error:', err);
      }
    }

    start();

    return () => {
      isMounted = false;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => updateDimensions();
    const handleResize = () => updateDimensions();

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('resize', handleResize);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('resize', handleResize);
    };
  }, [updateDimensions]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
