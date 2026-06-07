/**
 * Offline natural language date-time parser for VoicePilot V3.
 * Parses strings like:
 * - "tomorrow at 6 PM"
 * - "tomorrow at 9 AM"
 * - "tomorrow at 2 PM"
 * - "Friday at 10 AM"
 * - "at 8 PM"
 * - "every day at 7 PM"
 * - "every monday at 9 AM"
 * - "in 2 hours"
 * - "in 30 minutes"
 */

export interface ParsedDateTime {
  dateTime: Date;
  repeatType: "none" | "daily" | "weekly" | "monthly";
}

export function parseNaturalLanguageDateTime(input: string): ParsedDateTime {
  const text = input.toLowerCase().trim();
  const now = new Date();
  let targetDate = new Date(now);
  let repeatType: "none" | "daily" | "weekly" | "monthly" = "none";

  // Check for relatives like "in X hours" or "in Y minutes"
  const inHoursMatch = text.match(/in\s+(\d+)\s+hour/);
  if (inHoursMatch) {
    const hours = parseInt(inHoursMatch[1], 10);
    targetDate.setHours(targetDate.getHours() + hours);
    return { dateTime: targetDate, repeatType };
  }

  const inMinutesMatch = text.match(/in\s+(\d+)\s+minute/);
  if (inMinutesMatch) {
    const minutes = parseInt(inMinutesMatch[1], 10);
    targetDate.setMinutes(targetDate.getMinutes() + minutes);
    return { dateTime: targetDate, repeatType };
  }

  // Check repeating types
  if (text.includes("every day") || text.includes("each day")) {
    repeatType = "daily";
  } else if (text.includes("every monday") || text.includes("weekly on monday")) {
    repeatType = "weekly";
    // Find next Monday
    const currentDay = targetDate.getDay();
    const daysUntilMonday = (1 - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilMonday);
  } else if (text.includes("every month on the 1st")) {
    repeatType = "monthly";
    if (targetDate.getDate() > 1) {
      targetDate.setMonth(targetDate.getMonth() + 1);
    }
    targetDate.setDate(1);
  }

  // Handle markers: "today", "tomorrow", "friday", etc.
  let isTomorrow = text.includes("tomorrow");
  let isNextMonday = text.includes("next monday");
  let isNextFriday = text.includes("next friday") || (!text.includes("next") && text.includes("friday"));

  if (isTomorrow) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (isNextMonday) {
    const currentDay = targetDate.getDay();
    const daysUntilMon = (1 - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilMon);
  } else if (isNextFriday) {
    const currentDay = targetDate.getDay();
    const daysUntilFri = (5 - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilFri);
  }

  // Extract hours and minutes from strings like "6 PM", "9 AM", "2:30 PM", "8 PM", "7 PM"
  const timeRegex = /(\d+)(?::(\d+))?\s*(am|pm)/i;
  const timeMatch = text.match(timeRegex);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3].toLowerCase();

    if (ampm === "pm" && hour < 12) {
      hour += 12;
    } else if (ampm === "am" && hour === 12) {
      hour = 0;
    }

    targetDate.setHours(hour, minute, 0, 0);

    // If parsing a relative "at 8 PM" and that time has already passed today, and no relative is indicated
    if (!isTomorrow && !isNextMonday && !isNextFriday && targetDate < now && repeatType === "none") {
      // Suggest tomorrow
      targetDate.setDate(targetDate.getDate() + 1);
    }
  } else {
    // Default time if only relative day specified
    targetDate.setHours(9, 0, 0, 0); // Default to 9 AM
  }

  return { dateTime: targetDate, repeatType };
}
