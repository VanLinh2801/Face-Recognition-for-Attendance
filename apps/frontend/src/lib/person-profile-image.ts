import type { FaceRegistration } from "@/lib/types";

export function getLatestIndexedProfileAssetId(registrations: FaceRegistration[]) {
  return [...registrations]
    .filter(
      (registration) =>
        registration.registration_status === "indexed" &&
        registration.face_image_media_asset_id !== null &&
        registration.indexed_at !== null,
    )
    .sort((left, right) => Date.parse(right.indexed_at ?? "") - Date.parse(left.indexed_at ?? ""))
    .at(0)?.face_image_media_asset_id ?? null;
}
