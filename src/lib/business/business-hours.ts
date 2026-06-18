import { addDays, format, getHours, set } from "date-fns";

// Business opens at 7:00 AM.
export const BUSINESS_OPEN_HOUR = 7;

// Business closes/resets at 3:00 AM the next day.
export const BUSINESS_CLOSE_HOUR = 3;

// Create a new date with a specific hour.
function atHour(date: Date, hour: number) {
   
  return set(date, {
    hours: hour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
}

// Gets the current business day range.
// Example:
// Monday 7:00 AM → Tuesday 3:00 AM
export function getBusinessDayRange(now: Date = new Date()) {
  const hour = now.getHours();

  // Before 3 AM means we are still in yesterday's business day.
  const startDay = hour < BUSINESS_CLOSE_HOUR ? addDays(now, -1) : now;

  // Business always closes the day after it opens.
  const endDay = addDays(startDay, 1);
  


  return {
    start: atHour(startDay, BUSINESS_OPEN_HOUR),
    end: atHour(endDay, BUSINESS_CLOSE_HOUR),
  };
  
}

// Gets the next business reset/opening time.
export function getNextBusinessResetAt(now: Date = new Date()) {
  const hour = now.getHours();

  // Before 3 AM, current business day closes at 3 AM today.
  if (hour < BUSINESS_CLOSE_HOUR) {
    return atHour(now, BUSINESS_CLOSE_HOUR);
  }

  // Between 3 AM and 6:59 AM, next business opening is 7 AM today.
  if (hour < BUSINESS_OPEN_HOUR) {
    return atHour(now, BUSINESS_OPEN_HOUR);
  }

  // From 7 AM and after, next reset/closing is 3 AM tomorrow.
  return atHour(addDays(now, 1), BUSINESS_CLOSE_HOUR);
}

// Formats the business day range.
// Example: Jun 14, 7:00 AM to Jun 15, 3:00 AM
export function formatBusinessDayRange(start: Date, end: Date) {
  return `${format(start, "MMM d, h:mm a")} to ${format(end, "MMM d, h:mm a")}`;
}

