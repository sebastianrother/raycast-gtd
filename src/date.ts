export function getCurrentDate() {
  const currentDate = new Date();
  currentDate.setUTCDate(currentDate.getUTCDate() - 1);
  return currentDate;
}

export function getRelativeDate(date: Date) {
  const currentDate = getCurrentDate();

  const diff = date - currentDate;

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(Math.round(diff / 86400000), "day");
}
