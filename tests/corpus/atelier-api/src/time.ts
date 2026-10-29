export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
export const addHours = (d: Date, hours: number) => addMinutes(d, hours * 60);
