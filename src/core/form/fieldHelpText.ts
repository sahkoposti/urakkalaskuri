/** Wizardissa näytettävä ohjeteksti; tyhjä merkkijono = ei näytetä. */
export function visibleHelpText(helpText?: string): string | undefined {
  const text = helpText?.trim();
  return text ? text : undefined;
}
