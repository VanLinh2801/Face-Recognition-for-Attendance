import {
  attendanceEvents,
  dailySummary,
  departments,
  hourlyStats,
  mediaAssets,
  persons,
  realtimeEvents,
  recognitionEvents,
  registrations,
  spoofAlertEvents,
  unknownEvents,
} from "@/lib/mock-data";

export function listPersons() {
  return { items: persons, total: persons.length, page: 1, page_size: 20 };
}

export function getPerson(id: string) {
  return persons.find((person) => person.id === id) ?? persons[0];
}

export function listDepartments() {
  return { items: departments, total: departments.length, page: 1, page_size: 20 };
}

export function listRegistrations(personId?: string) {
  const items = personId ? registrations.filter((item) => item.person_id === personId) : registrations;
  return { items, total: items.length, page: 1, page_size: 20 };
}

export function listAttendanceEvents(personId?: string) {
  const items = personId ? attendanceEvents.filter((item) => item.person_id === personId) : attendanceEvents;
  return { items, total: items.length, page: 1, page_size: 20 };
}

export function listRecognitionEvents() {
  return { items: recognitionEvents, total: recognitionEvents.length, page: 1, page_size: 20 };
}

export function listUnknownEvents() {
  return { items: unknownEvents, total: unknownEvents.length, page: 1, page_size: 20 };
}

export function listSpoofAlertEvents() {
  return { items: spoofAlertEvents, total: spoofAlertEvents.length, page: 1, page_size: 20 };
}

export function listMediaAssets() {
  return { items: mediaAssets, total: mediaAssets.length, page: 1, page_size: 20 };
}

export function listLatestEvents() {
  return realtimeEvents;
}

export function getDailySummary() {
  return dailySummary;
}

export function getHourlyStats() {
  return hourlyStats;
}

export function getDepartmentName(id: string | null) {
  if (!id) return "No department";
  return departments.find((department) => department.id === id)?.name ?? "Unknown";
}

export function getPersonName(id: string | null) {
  if (!id) return "Unknown";
  return persons.find((person) => person.id === id)?.full_name ?? "Unknown";
}
