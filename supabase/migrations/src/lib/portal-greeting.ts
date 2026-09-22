function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

export function portalGreeting(fullName: string, date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Africa/Nairobi',
    }).format(date),
  );

  const salutation =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';

  return `${salutation}, ${firstName(fullName)}`;
}
