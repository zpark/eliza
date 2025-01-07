import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs";
import localizedFormat from 'dayjs/plugin/localizedFormat'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

dayjs.extend(localizedFormat);

export const moment = dayjs;