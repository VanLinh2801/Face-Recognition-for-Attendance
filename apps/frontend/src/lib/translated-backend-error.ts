import type { useTranslations } from "next-intl";
import {
  normalizeBackendError,
  type BackendErrorContext,
  type BackendErrorKey,
} from "@/lib/backend-error-normalizer";

type Translator = ReturnType<typeof useTranslations>;

export function getTranslatedBackendError(
  t: Translator,
  error: unknown,
  context?: BackendErrorContext,
  fallbackKey: BackendErrorKey = "system.requestFailed",
) {
  const normalized = normalizeBackendError(error, context);
  const translationKey = `errors.${normalized.key}`;
  const fallbackTranslationKey = `errors.${fallbackKey}`;

  if (t.has(translationKey)) {
    return t(translationKey);
  }
  if (t.has(fallbackTranslationKey)) {
    return t(fallbackTranslationKey);
  }
  return normalized.fallbackMessage;
}
