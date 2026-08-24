import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatCurrencyZAR, formatDate } from '@/lib/utils';
import { WORK_ORDER_STATUS_LABELS, BBBEE_LABELS, type WorkOrder, type Merchant, type ChecklistItem, type Evidence, type WorkOrderPart, type QualityReview } from '@/lib/rt46';

const BRAND = '#0F6E3E';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  headerSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  reportTag: { alignItems: 'flex-end' },
  reportTagLabel: { fontSize: 8, color: MUTED, letterSpacing: 0.5 },
  reportTagValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND, marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  statusPill: {
    alignSelf: 'flex-start', backgroundColor: '#EAF7F0', color: BRAND, fontSize: 9,
    fontFamily: 'Helvetica-Bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginBottom: 10,
  },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', marginBottom: 8 },
  gridLabel: { fontSize: 8, color: MUTED, marginBottom: 2 },
  gridValue: { fontSize: 10 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  checkbox: { width: 9, height: 9, borderWidth: 1, borderColor: INK, marginRight: 6, borderRadius: 2 },
  checkboxChecked: { backgroundColor: BRAND, borderColor: BRAND },
  checklistText: { fontSize: 9 },
  photoSectionHeading: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  photoCell: { width: '33.33%', padding: 3 },
  photoImage: { width: '100%', height: 90, borderRadius: 6, objectFit: 'cover' },
  photoCaption: { fontSize: 6.5, color: MUTED, marginTop: 3, textAlign: 'center' },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5, marginBottom: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 5 },
  colName: { flex: 3, fontSize: 8.5 },
  colSource: { flex: 1.2, fontSize: 8.5, textAlign: 'center' },
  colQty: { flex: 0.8, fontSize: 8.5, textAlign: 'center' },
  colCost: { flex: 1.3, fontSize: 8.5, textAlign: 'right' },
  colTotal: { flex: 1.3, fontSize: 8.5, textAlign: 'right' },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase' },
  totalsBlock: { marginTop: 10, alignSelf: 'flex-end', width: '55%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: MUTED },
  totalsValue: { fontSize: 9 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: INK, paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND },
  qualityBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  qualityScore: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: BRAND },
  qualityOutcome: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  footer: {
    position: 'absolute', bottom: 24, left: 32, right: 32, flexDirection: 'row',
    justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: MUTED },
});

export interface RT46ReportEvidence extends Evidence {
  url: string;
}

export interface RT46ReportProps {
  workOrder: WorkOrder;
  merchant: Merchant | null;
  vehicleLabel: string;
  checklist: ChecklistItem[];
  evidence: RT46ReportEvidence[];
  parts: WorkOrderPart[];
  latestReview: QualityReview | null;
  generatedAt: string;
}

function PhotoStageSection({ title, photos }: { title: string; photos: RT46ReportEvidence[] }) {
  if (!photos.length) return null;
  return (
    <View>
      <Text style={styles.photoSectionHeading}>{title}</Text>
      <View style={styles.photoGrid}>
        {photos.map((p) => (
          <View key={p.id} style={styles.photoCell}>
            <Image src={p.url} style={styles.photoImage} />
            <Text style={styles.photoCaption}>
              {formatDate(p.taken_at)} · {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function RT46WorkOrderReport({
  workOrder, merchant, vehicleLabel, checklist, evidence, parts, latestReview, generatedAt,
}: RT46ReportProps) {
  const partsTotal = parts.reduce((s, p) => s + Number(p.quantity) * Number(p.billed_unit_cost), 0);
  const labourTotal = (workOrder.labour_hours ?? 0) * (workOrder.labour_rate ?? 0);
  const before = evidence.filter((e) => e.stage === 'before');
  const during = evidence.filter((e) => e.stage === 'during');
  const after = evidence.filter((e) => e.stage === 'after');

  return (
    <Document title={`RT46 Work Order Report — ${vehicleLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>RT46 Fleet Repair Program</Text>
            <Text style={styles.headerSub}>National Treasury — Work Order Report</Text>
          </View>
          <View style={styles.reportTag}>
            <Text style={styles.reportTagLabel}>WORK ORDER</Text>
            <Text style={styles.reportTagValue}>{vehicleLabel}</Text>
          </View>
        </View>

        <Text style={styles.statusPill}>{WORK_ORDER_STATUS_LABELS[workOrder.status]}</Text>

        <Text style={styles.sectionTitle}>Work Order Details</Text>
        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Category</Text>
            <Text style={styles.gridValue}>{workOrder.category.replace('_', ' ')}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Priority</Text>
            <Text style={styles.gridValue}>{workOrder.priority}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Merchant</Text>
            <Text style={styles.gridValue}>{merchant?.trading_name ?? '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>B-BBEE Level</Text>
            <Text style={styles.gridValue}>{merchant ? BBBEE_LABELS[merchant.bbbee_level] : '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Allocated</Text>
            <Text style={styles.gridValue}>{workOrder.allocated_at ? formatDate(workOrder.allocated_at) : '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Completed</Text>
            <Text style={styles.gridValue}>{workOrder.completed_at ? formatDate(workOrder.completed_at) : '—'}</Text>
          </View>
        </View>
        {workOrder.description && (
          <View style={{ marginTop: 2 }}>
            <Text style={styles.gridLabel}>Description</Text>
            <Text style={{ fontSize: 9.5, lineHeight: 1.5 }}>{workOrder.description}</Text>
          </View>
        )}

        {checklist.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Quality Checklist</Text>
            {checklist.map((item) => (
              <View key={item.id} style={styles.checklistRow}>
                <View style={[styles.checkbox, item.is_checked ? styles.checkboxChecked : undefined]} />
                <Text style={styles.checklistText}>{item.quality_checklist_templates?.item_text}</Text>
              </View>
            ))}
          </>
        )}

        {(before.length > 0 || during.length > 0 || after.length > 0) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Photo Evidence (GPS + Timestamp)</Text>
            <PhotoStageSection title="Before" photos={before} />
            <PhotoStageSection title="During" photos={during} />
            <PhotoStageSection title="After" photos={after} />
          </>
        )}

        {(parts.length > 0 || workOrder.labour_hours) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Parts & Labour Breakdown</Text>
            {parts.length > 0 && (
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.colName, styles.thText]}>Part</Text>
                  <Text style={[styles.colSource, styles.thText]}>Source</Text>
                  <Text style={[styles.colQty, styles.thText]}>Qty</Text>
                  <Text style={[styles.colCost, styles.thText]}>Unit Cost</Text>
                  <Text style={[styles.colTotal, styles.thText]}>Total</Text>
                </View>
                {parts.map((p) => (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={styles.colName}>{p.part_name} ({p.part_number})</Text>
                    <Text style={styles.colSource}>{p.source ?? '—'}</Text>
                    <Text style={styles.colQty}>{p.quantity}</Text>
                    <Text style={styles.colCost}>{formatCurrencyZAR(Number(p.billed_unit_cost))}</Text>
                    <Text style={styles.colTotal}>{formatCurrencyZAR(Number(p.quantity) * Number(p.billed_unit_cost))}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.totalsBlock}>
              {parts.length > 0 && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Parts total</Text>
                  <Text style={styles.totalsValue}>{formatCurrencyZAR(partsTotal)}</Text>
                </View>
              )}
              {workOrder.labour_hours != null && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Labour ({workOrder.labour_hours} hrs @ {formatCurrencyZAR(workOrder.labour_rate ?? 0)}/hr)</Text>
                  <Text style={styles.totalsValue}>{formatCurrencyZAR(labourTotal)}</Text>
                </View>
              )}
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Job Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrencyZAR(partsTotal + labourTotal)}</Text>
              </View>
            </View>
          </>
        )}

        {latestReview && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Quality Decision</Text>
            <View style={styles.qualityBlock}>
              <View>
                <Text style={styles.qualityScore}>{latestReview.score}/100</Text>
                <Text style={{ fontSize: 8, color: MUTED }}>Reviewed {formatDate(latestReview.created_at)}</Text>
              </View>
              <Text style={[styles.qualityOutcome, { color: latestReview.outcome === 'pass' ? BRAND : '#C0362C' }]}>
                {latestReview.outcome}
              </Text>
            </View>
            {latestReview.notes && <Text style={{ fontSize: 9, marginTop: 6 }}>{latestReview.notes}</Text>}
          </>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {formatDate(generatedAt)} · RT46 National Treasury Fleet Repair Program</Text>
          <Text style={styles.footerText}>Work Order {workOrder.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
