export function getCurrentDate() {
  const currentDate = new Date();
  currentDate.setUTCHours(0, 0, 0, 0);
  return currentDate;
}

export function getRelativeDate(date: Date) {
  const currentDate = getCurrentDate();

  const diff = date - currentDate;

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(Math.round(diff / 86400000), "day");
}
