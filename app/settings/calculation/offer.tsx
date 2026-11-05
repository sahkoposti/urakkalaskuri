import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppInput, AppSwitch, PrimaryButton, ScreenLoading, SectionTitle } from '@/src/components/common';
import { db } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import {
  defaultOfferCompanySettings,
  normalizeOfferCompanySettings,
} from '@/src/core/pdf/defaultOfferSettings';
import {
  offerStructureSettingsFromPageDraft,
  structureOfferPageDraft,
  toggleStructureOfferPage,
  type StructureOfferPageDraft,
} from '@/src/core/pdf/offerPageDraft';
import { offerNumberStartWarning } from '@/src/core/pdf/offerNumber';
import type { OfferCompanySettings } from '@/src/core/pdf/types';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

/** Lomakkeen tekstikentät (numerot tekstinä, jotta tyhjennys ja desimaalipilkku toimivat). */
type CompanyDraft = {
  offerNumberStart: string;
  offerValidDays: string;
  ktvRatePercent: string;
  ktvDeductibleEur: string;
  ktvCapEur: string;
  ktvFootnoteText: string;
  additionalInfoText: string;
};

function toDraft(s: OfferCompanySettings): CompanyDraft {
  const n = (v: number) => String(v).replace('.', ',');
  return {
    offerNumberStart: String(s.offerNumberStart),
    offerValidDays: String(s.offerValidDays),
    ktvRatePercent: n(s.ktv.ratePercent),
    ktvDeductibleEur: n(s.ktv.deductibleEur),
    ktvCapEur: n(s.ktv.capEur),
    ktvFootnoteText: s.ktvFootnoteText,
    additionalInfoText: s.additionalInfoText,
  };
}

function fromDraft(d: CompanyDraft, sivukulukerroin: number): OfferCompanySettings {
  return normalizeOfferCompanySettings({
    offerNumberStart: d.offerNumberStart,
    offerValidDays: d.offerValidDays,
    ktv: { ratePercent: d.ktvRatePercent, deductibleEur: d.ktvDeductibleEur, capEur: d.ktvCapEur },
    ktvFootnoteText: d.ktvFootnoteText.trim(),
    additionalInfoText: d.additionalInfoText,
    sivukulukerroin,
  });
}

export default function OfferSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { showAlert } = useThemedAlert();
  const [loaded, setLoaded] = useState(false);
  const [storedCompany, setStoredCompany] = useState<CompanyDraft>(toDraft(defaultOfferCompanySettings));
  const [company, setCompany] = useState<CompanyDraft>(toDraft(defaultOfferCompanySettings));
  const [storedFactor, setStoredFactor] = useState(defaultOfferCompanySettings.sivukulukerroin);
  const [storedNextOfferNumber, setStoredNextOfferNumber] = useState<number | undefined>();
  const [pageDrafts, setPageDrafts] = useState<StructureOfferPageDraft[]>([]);
  const [storedPageDrafts, setStoredPageDrafts] = useState<StructureOfferPageDraft[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([db.getOfferCompanySettings(), db.getStoredNextOfferNumber(), db.getProductStructures()])
      .then(async ([companySettings, storedNext, structures]) => {
        if (!active) return;
        const drafts: StructureOfferPageDraft[] = [];
        for (const structure of structures) {
          const settings = await db.getOfferStructureSettings(structure.id);
          const draft = structureOfferPageDraft(structure, settings);
          if (draft && draft.pages.length > 0) drafts.push(draft);
        }
        if (!active) return;
        setStoredNextOfferNumber(storedNext);
        const draft = toDraft(companySettings);
        setStoredFactor(companySettings.sivukulukerroin);
        setStoredCompany(draft);
        setCompany(draft);
        setPageDrafts(drafts);
        setStoredPageDrafts(drafts);
      })
      .catch(() => {
        if (active) showAlert('Virhe', 'Tarjousasetusten lataus epäonnistui. Näytetään oletukset.');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [showAlert]);

  const isDirty = useMemo(
    () =>
      loaded &&
      (JSON.stringify(company) !== JSON.stringify(storedCompany) ||
        JSON.stringify(pageDrafts) !== JSON.stringify(storedPageDrafts)),
    [loaded, company, storedCompany, pageDrafts, storedPageDrafts],
  );

  async function persist(): Promise<boolean> {
    try {
      const companySettings = fromDraft(company, storedFactor);
      await db.saveOfferCompanySettings(companySettings);
      for (const draft of pageDrafts) {
        await db.saveOfferStructureSettings(draft.structureId, offerStructureSettingsFromPageDraft(draft));
      }
      const nextCompany = toDraft(companySettings);
      setStoredFactor(companySettings.sivukulukerroin);
      setStoredCompany(nextCompany);
      setCompany(nextCompany);
      setStoredPageDrafts(pageDrafts);
      return true;
    } catch {
      showAlert('Virhe', 'Tallennus epäonnistui.');
      return false;
    }
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({ isDirty, onSave: persist });

  if (!loaded) return <ScreenLoading />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
  }

  // Varoitus vain, kun aloitusnumeroa on muutettu (ei pysyvää varoitusta käytön jälkeen).
  const startWarning =
    company.offerNumberStart !== storedCompany.offerNumberStart
      ? offerNumberStartWarning(Number(company.offerNumberStart), storedNextOfferNumber)
      : null;

  const setField = (key: keyof CompanyDraft) => (value: string) =>
    setCompany((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <Stack.Screen options={{ title: 'Tarjous' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Tarjous" />
        <AppInput
          label="Tarjousnumeron aloitus"
          value={company.offerNumberStart}
          onChangeText={setField('offerNumberStart')}
          kind="integer"
        />
        {startWarning ? <Text style={styles.note}>{startWarning}</Text> : null}
        <AppInput
          label="Voimassaolo (pv)"
          value={company.offerValidDays}
          onChangeText={setField('offerValidDays')}
          kind="integer"
        />
        <Text style={styles.note}>Päättymispäivä lasketaan tarjouksen päiväyksestä.</Text>
        <AppInput
          label="Lisätiedot (kaikki tarjoukset)"
          value={company.additionalInfoText}
          onChangeText={setField('additionalInfoText')}
          kind="sentence"
          multiline
          placeholder="Valinnainen"
        />
        <Text style={styles.note}>
          Tulostuu tarjouksen Lisätiedot-osioon sellaisenaan (esim. maksuehto, takuu).
        </Text>
        {pageDrafts.map((draft) => (
          <View key={draft.structureId}>
            <SectionTitle title={draft.structureName} />
            <Text style={styles.note}>Tarjoukseen tulevat lomakkeen sivut.</Text>
            {draft.pages.map((page) => (
              <View key={page.pageId} style={styles.pageRow}>
                <Text style={styles.pageTitle}>{page.title}</Text>
                <AppSwitch
                  accessibilityLabel={page.title}
                  value={page.enabled}
                  onValueChange={(enabled) =>
                    setPageDrafts((current) =>
                      current.map((item) =>
                        item.structureId === draft.structureId
                          ? toggleStructureOfferPage(item, page.pageId, enabled)
                          : item,
                      ),
                    )
                  }
                />
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.sectionLabel}>Kotitalousvähennys (vain yksityisasiakas)</Text>
        <AppInput
          label="Vähennys % työn osuudesta (sis. ALV)"
          value={company.ktvRatePercent}
          onChangeText={setField('ktvRatePercent')}
          kind="decimal"
        />
        <AppInput
          label="Omavastuu € / henkilö / vuosi"
          value={company.ktvDeductibleEur}
          onChangeText={setField('ktvDeductibleEur')}
          kind="decimal"
        />
        <AppInput
          label="Enimmäismäärä € / henkilö / vuosi"
          value={company.ktvCapEur}
          onChangeText={setField('ktvCapEur')}
          kind="decimal"
        />
        <AppInput
          label="Huomautus KTV-sivulle"
          value={company.ktvFootnoteText}
          onChangeText={setField('ktvFootnoteText')}
          kind="sentence"
          multiline
          placeholder="Tyhjä = oletusteksti"
        />
        <Text style={styles.note}>
          Oletukset (vero.fi 29.10.2026, vuodet 2026–2027): 40 %, omavastuu 150 €, enintään 2 100 €.
          Virheellinen arvo palautuu oletukseen tallennettaessa.
        </Text>

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 8,
    },
    sectionLabel: {
      marginTop: 12,
      marginBottom: 4,
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    note: {
      marginBottom: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
    },
    pageRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
      paddingVertical: 4,
    },
    pageTitle: {
      flex: 1,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
    },
  };
}
