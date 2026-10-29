import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  AppCard,
  AppInput,
  AppSwitch,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
  SectionTitle,
} from '@/src/components/common';
import { db } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import {
  defaultOfferCompanySettings,
  normalizeOfferCompanySettings,
} from '@/src/core/pdf/defaultOfferSettings';
import { offerNumberStartWarning } from '@/src/core/pdf/offerNumber';
import { syncOfferPages, toOfferPageInclusions } from '@/src/core/pdf/syncOfferPages';
import type { OfferCompanySettings, SyncedOfferPage } from '@/src/core/pdf/types';
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

/** Lomakkeen tekstikentät (numerot tekstinä, jotta tyhjennys ja desimaalipilkku toimivat). */
type CompanyDraft = {
  offerNumberStart: string;
  offerValidDays: string;
  khvRatePercent: string;
  khvDeductibleEur: string;
  khvCapEur: string;
  khvFootnoteText: string;
};

function toDraft(s: OfferCompanySettings): CompanyDraft {
  const n = (v: number) => String(v).replace('.', ',');
  return {
    offerNumberStart: String(s.offerNumberStart),
    offerValidDays: String(s.offerValidDays),
    khvRatePercent: n(s.khv.ratePercent),
    khvDeductibleEur: n(s.khv.deductibleEur),
    khvCapEur: n(s.khv.capEur),
    khvFootnoteText: s.khvFootnoteText,
  };
}

function fromDraft(d: CompanyDraft): OfferCompanySettings {
  return normalizeOfferCompanySettings({
    offerNumberStart: d.offerNumberStart,
    offerValidDays: d.offerValidDays,
    khv: { ratePercent: d.khvRatePercent, deductibleEur: d.khvDeductibleEur, capEur: d.khvCapEur },
    khvFootnoteText: d.khvFootnoteText.trim(),
  });
}

export default function OfferSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { showAlert } = useThemedAlert();
  const { structureId, structure, formDefinition } = useStructureFormEditor();
  const [loaded, setLoaded] = useState(false);
  const [storedCompany, setStoredCompany] = useState<CompanyDraft>(toDraft(defaultOfferCompanySettings));
  const [company, setCompany] = useState<CompanyDraft>(toDraft(defaultOfferCompanySettings));
  const [storedInfo, setStoredInfo] = useState('');
  const [info, setInfo] = useState('');
  const [storedPages, setStoredPages] = useState<SyncedOfferPage[]>([]);
  const [pages, setPages] = useState<SyncedOfferPage[]>([]);
  const [storedNextOfferNumber, setStoredNextOfferNumber] = useState<number | undefined>();

  useEffect(() => {
    if (!formDefinition) return;
    let active = true;
    Promise.all([
      db.getOfferCompanySettings(),
      db.getOfferStructureSettings(structureId),
      db.getStoredNextOfferNumber(),
    ])
      .then(([companySettings, structureSettings, storedNext]) => {
        if (!active) return;
        setStoredNextOfferNumber(storedNext);
        const draft = toDraft(companySettings);
        setStoredCompany(draft);
        setCompany(draft);
        setStoredInfo(structureSettings.additionalInfoText);
        setInfo(structureSettings.additionalInfoText);
        const synced = syncOfferPages(formDefinition, structureSettings);
        setStoredPages(synced);
        setPages(synced);
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
  }, [formDefinition, structureId, showAlert]);

  const isDirty = useMemo(
    () =>
      loaded &&
      (JSON.stringify(company) !== JSON.stringify(storedCompany) ||
        info !== storedInfo ||
        JSON.stringify(toOfferPageInclusions(pages)) !== JSON.stringify(toOfferPageInclusions(storedPages))),
    [loaded, company, storedCompany, info, storedInfo, pages, storedPages],
  );

  async function persist(): Promise<boolean> {
    try {
      const companySettings = fromDraft(company);
      await db.saveOfferCompanySettings(companySettings);
      await db.saveOfferStructureSettings(structureId, {
        additionalInfoText: info.trim(),
        offerPages: toOfferPageInclusions(pages),
      });
      const draft = toDraft(companySettings);
      setStoredCompany(draft);
      setCompany(draft);
      setStoredInfo(info.trim());
      setInfo(info.trim());
      setStoredPages(pages);
      return true;
    } catch {
      showAlert('Virhe', 'Tallennus epäonnistui.');
      return false;
    }
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({ isDirty, onSave: persist });

  if (!formDefinition) return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;
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
        <SectionTitle title={structure?.name ? `Tämä rakenne: ${structure.name}` : 'Tämä rakenne'} />
        <AppInput label="Lisätiedot" value={info} onChangeText={setInfo} multiline placeholder="Valinnainen" />
        <Text style={styles.note}>
          Tulostuu tarjouksen Lisätiedot-osioon. Tyhjä = osio jätetään pois. Usean rakenteen laskelmassa
          käytetään ensimmäisen rakenteen tekstiä.
        </Text>

        <Text style={styles.sectionLabel}>Lomakesivut tarjouksessa</Text>
        {pages.length === 0 ? <Text style={styles.note}>Lomakkeella ei ole sivuja.</Text> : null}
        {pages.map((page) => (
          <AppCard key={page.pageId}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{page.title}</Text>
              <AppSwitch
                value={page.enabled}
                onValueChange={(enabled) =>
                  setPages((prev) => prev.map((p) => (p.pageId === page.pageId ? { ...p, enabled } : p)))
                }
              />
            </View>
          </AppCard>
        ))}

        <SectionTitle title="Yhteiset (kaikki tuoterakenteet)" />
        <AppInput
          label="Tarjousnumeron aloitus"
          value={company.offerNumberStart}
          onChangeText={setField('offerNumberStart')}
          keyboardType="numeric"
        />
        {startWarning ? <Text style={styles.note}>{startWarning}</Text> : null}
        <AppInput
          label="Voimassaolo (pv)"
          value={company.offerValidDays}
          onChangeText={setField('offerValidDays')}
          keyboardType="numeric"
        />
        <Text style={styles.note}>Päättymispäivä lasketaan tarjouksen päiväyksestä.</Text>

        <Text style={styles.sectionLabel}>Kotitalousvähennys (vain yksityisasiakas)</Text>
        <AppInput
          label="Vähennys % työn osuudesta (sis. ALV)"
          value={company.khvRatePercent}
          onChangeText={setField('khvRatePercent')}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Omavastuu € / henkilö / vuosi"
          value={company.khvDeductibleEur}
          onChangeText={setField('khvDeductibleEur')}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Enimmäismäärä € / henkilö / vuosi"
          value={company.khvCapEur}
          onChangeText={setField('khvCapEur')}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Huomautus KHV-sivulle"
          value={company.khvFootnoteText}
          onChangeText={setField('khvFootnoteText')}
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
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    rowTitle: {
      flex: 1,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    note: {
      marginBottom: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
    },
  };
}
