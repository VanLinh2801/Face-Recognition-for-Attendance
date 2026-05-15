"use client";

import { apiFetch } from "@/lib/api-client";
import type { FilterPolicy } from "@/lib/types";

let filterPolicyPromise: Promise<FilterPolicy> | null = null;

export async function getFilterPolicy(): Promise<FilterPolicy> {
  if (!filterPolicyPromise) {
    filterPolicyPromise = apiFetch<FilterPolicy>("/system/filter-policy", { withAuth: true }).catch((error) => {
      filterPolicyPromise = null;
      throw error;
    });
  }
  return filterPolicyPromise;
}

export function getEventBoundaryValues(policy: FilterPolicy) {
  const serverNow = new Date(policy.server_now);
  const minDate = new Date(serverNow);
  minDate.setUTCDate(minDate.getUTCDate() - policy.retention_days);
  const maxDate = new Date(serverNow);
  maxDate.setUTCHours(maxDate.getUTCHours() + policy.events.max_future_hours);

  return {
    minEventStart: toLocalDateTimeInputValue(minDate),
    maxEventEnd: toLocalDateTimeInputValue(maxDate),
  };
}

export function getAttendanceBoundaryValues(policy: FilterPolicy) {
  const serverNow = new Date(policy.server_now);
  const maxDate = toLocalDateInputValue(serverNow);
  const minDateValue = new Date(serverNow);
  minDateValue.setUTCDate(minDateValue.getUTCDate() - policy.retention_days);

  return {
    minAttendanceDate: toLocalDateInputValue(minDateValue),
    maxAttendanceDate: maxDate,
  };
}

export function getDefaultEventRange(policy: FilterPolicy) {
  const { minEventStart, maxEventEnd } = getEventBoundaryValues(policy);
  const serverNow = new Date(policy.server_now);
  const startOfDay = new Date(serverNow);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(serverNow);
  endOfDay.setHours(23, 59, 0, 0);

  return normalizeEventRange(
    {
      fromTime: toLocalDateTimeInputValue(startOfDay),
      toTime: toLocalDateTimeInputValue(endOfDay),
    },
    policy,
  ) ?? { fromTime: minEventStart, toTime: maxEventEnd };
}

export function getDefaultAttendanceRange(policy: FilterPolicy) {
  const { minAttendanceDate, maxAttendanceDate } = getAttendanceBoundaryValues(policy);
  const maxDateValue = new Date(`${maxAttendanceDate}T00:00:00Z`);
  const reportStart = new Date(maxDateValue);
  reportStart.setUTCDate(reportStart.getUTCDate() - 6);

  return {
    workDate: maxAttendanceDate,
    reportFromDate: maxDate(reportStart.toISOString().slice(0, 10), minAttendanceDate),
    reportToDate: maxAttendanceDate,
  };
}

export function normalizeEventRange(
  range: { fromTime: string; toTime: string },
  policy: FilterPolicy,
  anchor: "from" | "to" = "from",
) {
  const { minEventStart, maxEventEnd } = getEventBoundaryValues(policy);
  const normalizedFrom = clampLocalDateTimeValue(range.fromTime, minEventStart, maxEventEnd);
  const normalizedTo = clampLocalDateTimeValue(range.toTime, minEventStart, maxEventEnd);
  if (!normalizedFrom || !normalizedTo) return null;

  if (parseLocalDateTimeValue(normalizedFrom).getTime() <= parseLocalDateTimeValue(normalizedTo).getTime()) {
    return { fromTime: normalizedFrom, toTime: normalizedTo };
  }

  return anchor === "from"
    ? { fromTime: normalizedFrom, toTime: normalizedFrom }
    : { fromTime: normalizedTo, toTime: normalizedTo };
}

export function normalizeAttendanceDate(value: string, policy: FilterPolicy) {
  const { minAttendanceDate, maxAttendanceDate } = getAttendanceBoundaryValues(policy);
  return clampDateValue(value, minAttendanceDate, maxAttendanceDate);
}

export function normalizeAttendanceRange(
  range: { fromDate: string; toDate: string },
  policy: FilterPolicy,
  anchor: "from" | "to" = "from",
) {
  const { minAttendanceDate, maxAttendanceDate } = getAttendanceBoundaryValues(policy);
  const normalizedFrom = clampDateValue(range.fromDate, minAttendanceDate, maxAttendanceDate);
  const normalizedTo = clampDateValue(range.toDate, minAttendanceDate, maxAttendanceDate);
  if (!normalizedFrom || !normalizedTo) return null;

  if (normalizedFrom <= normalizedTo) {
    return { fromDate: normalizedFrom, toDate: normalizedTo };
  }

  return anchor === "from"
    ? { fromDate: normalizedFrom, toDate: normalizedFrom }
    : { fromDate: normalizedTo, toDate: normalizedTo };
}

export function buildAttendanceApiRange(
  policy: FilterPolicy,
  range: { fromDate: string; toDate: string },
) {
  const normalizedRange = normalizeAttendanceRange(range, policy);
  if (!normalizedRange) return null;

  const { maxAttendanceDate } = getAttendanceBoundaryValues(policy);
  const startDate = parseLocalDateValue(normalizedRange.fromDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate =
    normalizedRange.toDate === maxAttendanceDate
      ? new Date(policy.server_now)
      : parseLocalDateValue(normalizedRange.toDate);

  if (normalizedRange.toDate !== maxAttendanceDate) {
    endDate.setHours(23, 59, 59, 0);
  }

  return {
    fromAt: startDate.toISOString(),
    toAt: endDate.toISOString(),
    fromDate: normalizedRange.fromDate,
    toDate: normalizedRange.toDate,
  };
}

export function toLocalDateTimeInputValue(date: Date) {
  return [
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  ].join("T");
}

export function toLocalDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDateTimeValue(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

export function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

function clampLocalDateTimeValue(value: string, minValue: string, maxValue: string) {
  if (!value) return "";
  const input = parseLocalDateTimeValue(value).getTime();
  const min = parseLocalDateTimeValue(minValue).getTime();
  const max = parseLocalDateTimeValue(maxValue).getTime();

  if (input < min) return minValue;
  if (input > max) return maxValue;
  return value;
}

function clampDateValue(value: string, minValue: string, maxValue: string) {
  if (!value) return "";
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

function maxDate(left: string, right: string) {
  return left >= right ? left : right;
}
