'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronsUpDown,
  Copy,
  FileDown,
  FileText,
  FileUp,
  Layers,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils/cn';
import { SLOBullets } from '../tvet-document-viewer';
import {
  distributeTopicsAcrossWeeks,
} from '../distribution-engine';
import type { AssessmentMilestones } from '../assessment-milestones';
import {
  saveOnlineCurriculumAction,
  parseDocxSyllabusAction,
  type OnlineTopicItem,
  type OnlineCurriculumPayload,
} from './actions';

export interface SystemUnitOption {
  id: string;
  code: string;
  name: string;
}

interface OnlineCurriculumBuilderProps {
  units?: SystemUnitOption[];
  initialUnitId?: string;
  milestones: AssessmentMilestones;
  existingCurriculumMap?: Record<string, {
    unitDescription?: string;
    coreLearningOutcomes?: string;
    references?: string;
    topics: { topicTitle: string; subTopics: string[] }[];
  }>;
}

/** Searchable Unit Selector allowing trainers to search units by code or name */
function SearchableUnitSelect({
  units,
  selectedUnitId,
  onSelectUnit,
}: {
  units: SystemUnitOption[];
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
    );
  }, [units, searchQuery]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
        Search & Select Unit
      </label>

      <button
        type="button"
        onClick={handleOpen}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-2.5 text-left text-xs font-semibold text-text-primary shadow-sm hover:border-border-strong focus:border-primary focus:outline-none transition"
      >
        <span className="truncate">
          {selectedUnit ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-800">
                {selectedUnit.code}
              </span>
              <span className="truncate font-medium text-slate-700">{selectedUnit.name}</span>
            </span>
          ) : (
            <span className="text-text-muted italic">Custom / Unlisted Unit</span>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-text-muted" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] sm:min-w-[340px] rounded-xl border border-slate-300 bg-white p-2 shadow-2xl animate-in fade-in-0 zoom-in-95">
          {/* Search Input Box */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or title (e.g. DHN, Bio)..."
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Unit List */}
          <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onSelectUnit('');
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition',
                !selectedUnitId ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-600'
              )}
            >
              <span>+ Custom / Unlisted Unit</span>
              {!selectedUnitId && <Check className="size-3.5 text-slate-900" />}
            </button>

            <div className="border-t border-slate-100 my-1" />

            {filteredUnits.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No units match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredUnits.map((u) => {
                const isSelected = u.id === selectedUnitId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectUnit(u.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition',
                      isSelected ? 'bg-slate-900 text-white font-bold' : 'hover:bg-slate-100 text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black',
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                        )}
                      >
                        {u.code}
                      </span>
                      <span className="truncate text-xs">{u.name}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 shrink-0 text-white" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count info */}
          <div className="mt-2 border-t border-slate-100 pt-1.5 px-1 text-[10px] text-slate-500 flex justify-between">
            <span>{filteredUnits.length} units available</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-800 hover:underline font-semibold"
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_SAMPLE_TOPICS: OnlineTopicItem[] = [
  { id: '1', topicTitle: 'Introduction to Biochemistry & Molecular Organization', subTopics: 'Cellular chemical components · Chemical bonds · Water and aqueous solutions · pH and buffer systems' },
  { id: '2', topicTitle: 'Structure and Function of Carbohydrates', subTopics: 'Monosaccharides (aldoses/ketoses) · Disaccharides (sucrose, lactose, maltose) · Polysaccharides (starch, glycogen, cellulose) · Glycosidic bonds' },
  { id: '3', topicTitle: 'Lipids and Biological Membranes', subTopics: 'Fatty acids (saturated & unsaturated) · Triglycerides · Phospholipids · Cholesterol · Fluid mosaic membrane model' },
  { id: '4', topicTitle: 'Amino Acids, Peptides and Proteins', subTopics: 'Amino acid classification & zwitterions · Peptide bond formation · Primary, secondary, tertiary & quaternary protein structures' },
  { id: '5', topicTitle: 'Enzymes and Biocatalysis', subTopics: 'Enzyme classification · Active sites · Factors affecting enzyme velocity (pH, temperature, substrate) · Michaelis-Menten kinetics' },
  { id: '6', topicTitle: 'Enzyme Regulation & Clinical Diagnostics', subTopics: 'Reversible & irreversible inhibition · Allosteric regulation · Isoenzymes · Diagnostic significance of serum enzymes' },
  { id: '7', topicTitle: 'Bioenergetics and ATP Generation', subTopics: 'Free energy concept · High energy phosphates · Mitochondrial electron transport chain · Oxidative phosphorylation' },
  { id: '8', topicTitle: 'Carbohydrate Metabolism: Glycolysis & TCA Cycle', subTopics: 'Aerobic & anaerobic glycolysis · Pyruvate dehydrogenase complex · Citric acid cycle reactions & energy yield' },
  { id: '9', topicTitle: 'Lipid Metabolism and Fatty Acid Oxidation', subTopics: 'Fatty acid activation and transport · Beta-oxidation pathway · Ketone body synthesis & utilization · Lipogenesis overview' },
  { id: '10', topicTitle: 'Amino Acid Catabolism and Urea Cycle', subTopics: 'Transamination & oxidative deamination · Ammonia toxicity · Urea cycle steps and regulation · Clinical hyperammonemia' },
];

export function OnlineCurriculumBuilder({
  units = [],
  initialUnitId,
  milestones,
  existingCurriculumMap = {},
}: OnlineCurriculumBuilderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    initialUnitId || (units[0]?.id ?? '')
  );

  const matchedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId),
    [units, selectedUnitId]
  );

  const [unitCode, setUnitCode] = useState<string>(
    matchedUnit?.code || ''
  );
  const [unitName, setUnitName] = useState<string>(
    matchedUnit?.name || ''
  );

  const existingData = selectedUnitId ? existingCurriculumMap[selectedUnitId] : null;

  const [unitDescription, setUnitDescription] = useState<string>(
    existingData?.unitDescription || ''
  );
  const [overallCompetencies, setOverallCompetencies] = useState<string>(
    existingData?.coreLearningOutcomes || ''
  );
  const [references, setReferences] = useState<string>(
    existingData?.references || ''
  );

  const [topics, setTopics] = useState<OnlineTopicItem[]>(() => {
    if (existingData?.topics && existingData.topics.length > 0) {
      return existingData.topics.map((t, idx) => ({
        id: String(idx + 1),
        topicTitle: t.topicTitle,
        subTopics: t.subTopics.join(' · '),
      }));
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'editor' | 'preview_outline' | 'preview_scheme'>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingDocx, setIsUploadingDocx] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Handle unit change
  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    const target = units.find((u) => u.id === unitId);
    if (target) {
      setUnitCode(target.code);
      setUnitName(target.name);
    }
    const data = existingCurriculumMap[unitId];
    if (data) {
      setUnitDescription(data.unitDescription || '');
      setOverallCompetencies(data.coreLearningOutcomes || '');
      setReferences(data.references || '');
      if (data.topics && data.topics.length > 0) {
        setTopics(
          data.topics.map((t, idx) => ({
            id: String(idx + 1),
            topicTitle: t.topicTitle,
            subTopics: t.subTopics.join(' · '),
          }))
        );
      }
    } else {
      // No saved curriculum for this unit — clear all fields
      setUnitDescription('');
      setOverallCompetencies('');
      setReferences('');
      setTopics([]);
    }
  };

  // Word Document (.docx) Upload & Auto-Normalization
  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDocx(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await parseDocxSyllabusAction(formData);

      if (res.success && res.data) {
        let matchedUnitName = '';
        if (res.data.unitCode) {
          setUnitCode(res.data.unitCode);
          const cleanUploaded = res.data.unitCode.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matched = units.find(
            (u) => u.code.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanUploaded
          );
          if (matched) {
            setSelectedUnitId(matched.id);
            matchedUnitName = matched.name;
          }
        }
        if (res.data.unitName) {
          setUnitName(res.data.unitName);
        } else if (matchedUnitName) {
          setUnitName(matchedUnitName);
        }

        if (res.data.unitDescription) setUnitDescription(res.data.unitDescription);
        if (res.data.overallCompetencies) setOverallCompetencies(res.data.overallCompetencies);
        if (res.data.references) setReferences(res.data.references);

        if (res.data.topics && res.data.topics.length > 0) {
          setTopics(
            res.data.topics.map((t, idx) => ({
              id: String(Date.now() + idx),
              topicTitle: t.topicTitle,
              subTopics: t.subTopics,
            }))
          );
        }
        alert(`Normalized Word document: ${res.data.topics.length} topics extracted into the template.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to parse Word document.');
    } finally {
      setIsUploadingDocx(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Topic list operations
  const addTopicRow = () => {
    const newId = String(Date.now());
    setTopics((prev) => [
      ...prev,
      {
        id: newId,
        topicTitle: '',
        subTopics: '',
      },
    ]);
  };

  const updateTopic = (id: string, field: keyof OnlineTopicItem, value: string) => {
    setTopics((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const removeTopic = (id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const duplicateTopic = (id: string) => {
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const target = topics[idx];
    const newTopic: OnlineTopicItem = {
      ...target,
      id: String(Date.now()),
      topicTitle: `${target.topicTitle} (Copy)`,
    };
    const next = [...topics];
    next.splice(idx + 1, 0, newTopic);
    setTopics(next);
  };

  const moveTopic = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= topics.length) return;
    const next = [...topics];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setTopics(next);
  };

  // Quick paste syllabus text
  const handleQuickPaste = () => {
    if (!pasteText.trim()) {
      setShowPasteModal(false);
      return;
    }

    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: OnlineTopicItem[] = [];
    lines.forEach((line, idx) => {
      const cleanLine = line.replace(/^[\d.)\s-]+/, '');
      const parts = cleanLine.split(/[:–—\-]\s*/);

      if (parts.length > 1) {
        parsed.push({
          id: String(Date.now() + idx),
          topicTitle: parts[0].trim(),
          subTopics: parts.slice(1).join(' · ').trim(),
        });
      } else {
        parsed.push({
          id: String(Date.now() + idx),
          topicTitle: cleanLine.trim(),
          subTopics: '',
        });
      }
    });

    if (parsed.length > 0) {
      setTopics(parsed);
    }
    setPasteText('');
    setShowPasteModal(false);
  };

  // Live 14-Week Distribution preview
  const distributedSchedule = useMemo(() => {
    const rawInput = topics
      .filter((t) => t.topicTitle.trim().length > 0)
      .map((t) => ({
        topicTitle: t.topicTitle.trim(),
        subTopics: t.subTopics
          .split(/[\n·;,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        learningOutcomes: t.learningOutcomes,
        activities: t.activities,
        resources: t.resources || undefined,
      }));

    return distributeTopicsAcrossWeeks(rawInput, 14, milestones);
  }, [topics, milestones]);

  const [isExportingWord, setIsExportingWord] = useState(false);

  // Export Word (.docx) directly from syllabus preview
  const handleExportWord = async () => {
    if (!unitCode.trim()) {
      alert('Please enter a Unit Code first.');
      return;
    }
    const validTopics = topics.filter((t) => t.topicTitle.trim().length > 0);
    if (validTopics.length === 0) {
      alert('Please add at least one topic before exporting.');
      return;
    }

    setIsExportingWord(true);
    try {
      const header = {
        institutionName: 'Imperial College of Medical & Health Sciences',
        departmentName: 'CLINICAL MEDICINE & ACADEMICS',
        academicPeriodName: 'CURRENT ACADEMIC PERIOD',
        unitCode: unitCode.trim().toUpperCase(),
        unitName: unitName.trim() || unitCode.trim().toUpperCase(),
        cohortName: 'ALL REGISTERED COHORTS',
        trainerName: 'COURSE TRAINER',
        totalNominalHours: 56,
        weeklyHours: 4,
      };

      const docType = activeTab === 'preview_outline' ? 'course_outline' : 'scheme_of_work';

      const payload = {
        type: docType,
        courseOutline: {
          header,
          unitDescription: unitDescription.trim() || 'Comprehensive TVET unit study curriculum.',
          overallCompetency: overallCompetencies.trim(),
          learningOutcomes: overallCompetencies
            ? overallCompetencies
                .split(/[\n;]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : ['Demonstrate core competencies in unit coverage.'],
          weeklySchedule: distributedSchedule.map((d) => ({
            weekNumber: d.weekNumber,
            topicTitle: d.topicTitle,
            subTopics: d.subTopics,
            hours: 4,
          })),
          teachingLearningApproaches: 'Interactive lectures · Practical sessions · Group discussion',
          assessmentApproaches: 'Continuous Assessment Tests (CATs) · Assignments · Final Examination',
          references: references
            ? references.split(/[\n;]+/).map((r) => r.trim()).filter(Boolean)
            : ['Core Textbook'],
          instructionalEquipment: ['Whiteboard', 'Projector', 'Laboratory Equipment'],
          assessmentMatrix: {
            continuousAssessment: { assignment: 10, presentation: 5, rat: 5, cat: 10, courseworkWeightedTotal: 30 },
            finalExamination: 70,
            finalTotal: 100,
          },
        },
        schemeOfWork: {
          header,
          plannedWeeks: distributedSchedule.map((d) => ({
            weekNumber: d.weekNumber,
            topic: d.topicTitle,
            subTopics: d.subTopics.join(' · '),
            specificLearningOutcomes: d.specificLearningOutcomes,
            learningActivities: d.learningActivities,
            resourcesAndReferences: d.resourcesAndReferences,
            assessmentAndRemarks: d.assessmentAndRemarks,
          })),
        },
      };

      const res = await fetch('/api/teaching-documents/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Word export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${unitCode.trim().toUpperCase()}_${docType}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Word export failed');
    } finally {
      setIsExportingWord(false);
    }
  };

  // Save & Publish
  const handleSave = async () => {
    if (!unitCode.trim()) {
      alert('Please enter a Unit Code (e.g. DHN 2304).');
      return;
    }

    const validTopics = topics.filter((t) => t.topicTitle.trim().length > 0);
    if (validTopics.length === 0) {
      alert('Please enter at least one topic for the syllabus.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: OnlineCurriculumPayload = {
        unitId: selectedUnitId || undefined,
        unitCode: unitCode.trim().toUpperCase(),
        unitName: unitName.trim() || unitCode.trim().toUpperCase(),
        unitDescription: unitDescription.trim(),
        overallCompetencies: overallCompetencies.trim(),
        references: references.trim(),
        topics: validTopics,
      };

      const res = await saveOnlineCurriculumAction(payload);
      alert(res.message);
      router.push('/teaching-documents/curriculum');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save curriculum');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input for Word upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".docx"
        onChange={handleDocxUpload}
        className="hidden"
      />

      <PageHeader
        eyebrow="Teaching documents"
        title="Syllabus Editor"
        description="Configure unit topics and preview 14-week schedules."
        icon={Sparkles}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/teaching-documents/curriculum"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>

            <Button
              onClick={handleSave}
              disabled={isSaving || !unitCode.trim()}
              leadingIcon={isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            >
              {isSaving ? 'Publishing...' : 'Save & Publish'}
            </Button>
          </div>
        }
      />

      {/* Unit Selector & Top Controls */}
      <Card className="p-3.5 bg-surface border-border">
        <div className="grid gap-3 sm:grid-cols-12 items-end">
          {units.length > 0 ? (
            <div className="sm:col-span-4">
              <SearchableUnitSelect
                units={units}
                selectedUnitId={selectedUnitId}
                onSelectUnit={handleUnitChange}
              />
            </div>
          ) : null}

          <div className={units.length > 0 ? 'sm:col-span-2' : 'sm:col-span-3'}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Unit Code
            </label>
            <input
              type="text"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="e.g. DHN 2304"
              className="w-full h-9 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div className={units.length > 0 ? 'sm:col-span-3' : 'sm:col-span-3'}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Unit Name
            </label>
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g. Biochemistry II"
              className="w-full h-9 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div className={units.length > 0 ? 'sm:col-span-3 flex justify-end gap-1.5' : 'sm:col-span-4 flex justify-end gap-1.5'}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingDocx}
              leadingIcon={isUploadingDocx ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileUp className="size-3.5" />}
            >
              {isUploadingDocx ? 'Normalizing...' : 'Upload Word (.docx)'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasteModal(true)}
              leadingIcon={<Copy className="size-3.5" />}
            >
              Quick Paste
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition border-b-2 ${
            activeTab === 'editor'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="size-3.5" />
          Topics ({topics.length})
        </button>

        <button
          onClick={() => setActiveTab('preview_outline')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition border-b-2 ${
            activeTab === 'preview_outline'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText className="size-3.5" />
          Course Outline
        </button>

        <button
          onClick={() => setActiveTab('preview_scheme')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition border-b-2 ${
            activeTab === 'preview_scheme'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <BookOpen className="size-3.5" />
          Scheme of Work
        </button>
      </div>

      {/* TAB 1: TOPIC EDITOR */}
      {activeTab === 'editor' && (
        <div className="space-y-3">
          {/* Optional Unit Metadata Section */}
          <details className="rounded-xl border border-border bg-surface p-3 text-xs">
            <summary className="font-bold text-text-primary cursor-pointer select-none">
              Unit Overview & References (Optional)
            </summary>
            <div className="grid gap-3 pt-3 sm:grid-cols-3">
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Unit Description</label>
                <textarea
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  placeholder="Principles and scope of the unit..."
                  className="w-full h-16 rounded-lg border border-border p-2 text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Core Competencies</label>
                <textarea
                  value={overallCompetencies}
                  onChange={(e) => setOverallCompetencies(e.target.value)}
                  placeholder="Key exit learning competencies..."
                  className="w-full h-16 rounded-lg border border-border p-2 text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-secondary mb-1">References & Textbooks</label>
                <textarea
                  value={references}
                  onChange={(e) => setReferences(e.target.value)}
                  placeholder="Core textbooks and reference manuals..."
                  className="w-full h-16 rounded-lg border border-border p-2 text-xs text-text-primary"
                />
              </div>
            </div>
          </details>

          {/* Topics Table */}
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              <div className="bg-surface-subtle px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted grid grid-cols-[2.5rem_1fr_1.5fr_6rem] items-center gap-3">
                <span className="text-center">#</span>
                <span>Topic Title</span>
                <span>Sub-topics & Coverage</span>
                <span className="text-right">Actions</span>
              </div>

              {topics.map((t, index) => (
                <div
                  key={t.id}
                  className="p-2.5 grid grid-cols-[2.5rem_1fr_1.5fr_6rem] items-start gap-3 transition hover:bg-surface-subtle"
                >
                  <div className="flex justify-center pt-2">
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={t.topicTitle}
                      onChange={(e) => updateTopic(t.id, 'topicTitle', e.target.value)}
                      placeholder="e.g. Structure of Carbohydrates"
                      className="w-full h-9 rounded-lg border border-border px-3 text-xs font-semibold text-text-primary focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <textarea
                      value={t.subTopics}
                      onChange={(e) => updateTopic(t.id, 'subTopics', e.target.value)}
                      placeholder="e.g. Monosaccharides · Disaccharides · Polysaccharides · Glycosidic bonds"
                      rows={2}
                      className="w-full rounded-lg border border-border p-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-1">
                    <button
                      onClick={() => moveTopic(index, 'up')}
                      disabled={index === 0}
                      title="Move Up"
                      className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>

                    <button
                      onClick={() => moveTopic(index, 'down')}
                      disabled={index === topics.length - 1}
                      title="Move Down"
                      className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>

                    <button
                      onClick={() => duplicateTopic(t.id)}
                      title="Duplicate Topic"
                      className="p-1.5 rounded text-text-muted hover:text-primary"
                    >
                      <Copy className="size-3.5" />
                    </button>

                    <button
                      onClick={() => removeTopic(t.id)}
                      title="Delete Topic"
                      className="p-1.5 rounded text-text-muted hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-surface-subtle/50 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={addTopicRow}
                leadingIcon={<Plus className="size-3.5" />}
              >
                Add Topic
              </Button>

              <div className="text-xs text-text-muted font-medium">
                {topics.length} topics → 14 weeks
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: LIVE 14-WEEK COURSE OUTLINE PREVIEW */}
      {activeTab === 'preview_outline' && (
        <Card className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          {/* Unit name banner */}
          <div className="border-b-2 border-slate-900 bg-slate-100 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Course Outline Preview</p>
              <h3 className="text-sm font-black tracking-wide text-slate-900 uppercase">
                {unitCode || 'Unit Code'} — {unitName || 'Unit Name'}
              </h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportWord}
              disabled={isExportingWord}
              className="bg-white text-slate-800 border-slate-300 hover:bg-slate-50 h-7 text-[11px] font-bold"
              leadingIcon={isExportingWord ? <LoaderCircle className="size-3 animate-spin" /> : <FileDown className="size-3" />}
            >
              Export Word (.docx)
            </Button>
          </div>

          <table className="w-full border-collapse text-[11px] table-fixed border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900">
                <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black">Week</th>
                <th className="border border-slate-300 px-3 py-2 text-left w-[32%] font-black">Topic Title</th>
                <th className="border border-slate-300 px-3 py-2 text-left w-[52%] font-black">Content / Sub-topics to be Covered</th>
                <th className="border border-slate-300 px-2 py-2 text-center w-[8%] font-black">Hours</th>
              </tr>
            </thead>
            <tbody>
              {distributedSchedule.map((row, idx) => {
                const subtopicList = row.subTopics.flatMap((st) =>
                  typeof st === 'string' ? st.split(/\s*[·;]\s*/).filter(Boolean) : []
                );

                return (
                  <tr key={row.weekNumber} className={idx % 2 === 0 ? 'bg-white align-top' : 'bg-slate-50 align-top'}>
                    <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                      W{row.weekNumber}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900 leading-snug">
                      {row.topicTitle || '—'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-800 leading-relaxed">
                      {subtopicList.length > 0 ? (
                        <ul className="space-y-1">
                          {subtopicList.map((sub, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5 leading-snug">
                              <span className="shrink-0 text-slate-900 font-bold">•</span>
                              <span>{sub.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400 italic">Core topic mastery and practical coverage.</span>
                      )}
                    </td>
                    <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                      4 hrs
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* TAB 3: LIVE 14-WEEK SCHEME OF WORK PREVIEW */}
      {activeTab === 'preview_scheme' && (
        <Card className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          {/* Unit name banner */}
          <div className="border-b-2 border-slate-900 bg-slate-100 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Scheme of Work Preview</p>
              <h3 className="text-sm font-black tracking-wide text-slate-900 uppercase">
                {unitCode || 'Unit Code'} — {unitName || 'Unit Name'}
              </h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportWord}
              disabled={isExportingWord}
              className="bg-white text-slate-800 border-slate-300 hover:bg-slate-50 h-7 text-[11px] font-bold"
              leadingIcon={isExportingWord ? <LoaderCircle className="size-3 animate-spin" /> : <FileDown className="size-3" />}
            >
              Export Word (.docx)
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px] table-fixed border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-400">
                  <th className="border border-slate-300 px-2 py-2 text-center w-[5%] font-black">Wk</th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-[25%] font-black">Topic & Sub-topics</th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-[40%] font-black">Specific Learning Outcomes (SLOs)</th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-[16%] font-black">Activities & Methodology</th>
                  <th className="border border-slate-300 px-2.5 py-2 text-left w-[14%] font-black">Instructional Resources</th>
                </tr>
              </thead>
              <tbody>
                {distributedSchedule.map((w, idx) => (
                  <tr key={w.weekNumber} className={`align-top ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="border border-slate-300 px-2 py-2 text-center font-black text-slate-900">
                      {w.weekNumber}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2">
                      <div className="font-bold text-slate-900 leading-snug">{w.topicTitle}</div>
                      {w.subTopics.length > 0 && (
                        <div className="mt-1 text-[9px] text-slate-600 leading-relaxed">{w.subTopics.join(' · ')}</div>
                      )}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                      <SLOBullets text={w.specificLearningOutcomes} />
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                      {w.learningActivities}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-2 text-slate-800 leading-relaxed">
                      {w.resourcesAndReferences}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* QUICK PASTE MODAL */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-text-primary">
              Quick Paste Syllabus Text
            </h3>
            <p className="text-xs text-text-muted">
              Paste numbered topics from Word or PDF. Each line will become a topic row.
              <br />
              <em>Example: Structure of Carbohydrates: Monosaccharides, Disaccharides</em>
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`1. Introduction to Biochemistry: Cell structure, Chemical bonds\n2. Carbohydrates: Monosaccharides, Disaccharides\n3. Lipids: Fatty acids, Membranes`}
              className="w-full h-44 rounded-xl border border-border p-3 text-xs font-mono text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPasteModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleQuickPaste}>
                Convert to Topics Table
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
