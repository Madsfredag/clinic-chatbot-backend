export type SafetyResult = {
  shouldEscalate: boolean;
  escalationMessage?: string;
};

const urgentPatterns = [
  /kraftig blødning/i,
  /ukontrolleret blødning/i,
  /hævelse/i,
  /ansigtet hævet/i,
  /feber/i,
  /infektion/i,
  /svær smerte/i,
  /meget ondt/i,
  /tand slået ud/i,
  /brækket tand/i,
  /traume/i,
  /efter operation/i,
  /efter kirurgi/i,
  /kan ikke synke/i,
  /kan ikke åbne munden/i,
];

export function evaluateSafety(message: string, clinicName: string, clinicPhone: string): SafetyResult {
  const isUrgent = urgentPatterns.some((pattern) => pattern.test(message));

  if (!isUrgent) {
    return { shouldEscalate: false };
  }

  const contactLine = clinicPhone
    ? `Kontakt ${clinicName} hurtigst muligt på ${clinicPhone}.`
    : `Kontakt ${clinicName} hurtigst muligt direkte.`;

  return {
    shouldEscalate: true,
    escalationMessage:
      `Det kan være noget, der bør vurderes hurtigt. ${contactLine} ` +
      `Hvis du har kraftig hævelse, ukontrolleret blødning, feber eller stærke smerter, bør du søge akut tandlægehjælp.`,
  };
}