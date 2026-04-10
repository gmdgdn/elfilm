export type HoroscopeSign =
    | "Aries" | "Taurus" | "Gemini" | "Cancer"
    | "Leo" | "Virgo" | "Libra" | "Scorpio"
    | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export const HOROSCOPE_SIGNS: Record<HoroscopeSign, { ar: string, icon: string, dateRange: string }> = {
    Aries: { ar: "الحمل", icon: "♈", dateRange: "Mar 21 - Apr 19" },
    Taurus: { ar: "الثور", icon: "♉", dateRange: "Apr 20 - May 20" },
    Gemini: { ar: "الجوزاء", icon: "♊", dateRange: "May 21 - Jun 20" },
    Cancer: { ar: "السرطان", icon: "♋", dateRange: "Jun 21 - Jul 22" },
    Leo: { ar: "الأسد", icon: "♌", dateRange: "Jul 23 - Aug 22" },
    Virgo: { ar: "العذراء", icon: "♍", dateRange: "Aug 23 - Sep 22" },
    Libra: { ar: "الميزان", icon: "♎", dateRange: "Sep 23 - Oct 22" },
    Scorpio: { ar: "العقرب", icon: "♏", dateRange: "Oct 23 - Nov 21" },
    Sagittarius: { ar: "القوس", icon: "♐", dateRange: "Nov 22 - Dec 21" },
    Capricorn: { ar: "الجدي", icon: "♑", dateRange: "Dec 22 - Jan 19" },
    Aquarius: { ar: "الدلو", icon: "♒", dateRange: "Jan 20 - Feb 18" },
    Pisces: { ar: "الحوت", icon: "♓", dateRange: "Feb 19 - Mar 20" },
};

export function getHoroscope(dateStr: string | undefined): HoroscopeSign | null {
    if (!dateStr) return null;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    const month = date.getMonth() + 1;
    const day = date.getDate();

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";

    return null;
}
