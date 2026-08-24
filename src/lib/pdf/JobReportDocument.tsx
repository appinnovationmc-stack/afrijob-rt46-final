import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { formatCurrencyZAR, formatDate, JOB_TYPE_LABELS, JOB_STATUS_LABELS } from '@/lib/utils';
import type { Tables } from '@/types/database.types';

const BRAND = '#E85D04';
const INK = '#1A1A1A';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  logo: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  workshopBlock: { flexDirection: 'row', alignItems: 'center' },
  workshopName: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK },
  workshopMeta: { fontSize: 8, color: MUTED, marginTop: 2 },
  reportTag: { alignItems: 'flex-end' },
  reportTagLabel: { fontSize: 8, color: MUTED, letterSpacing: 0.5 },
  reportTagValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: BRAND, marginTop: 2 },

  divider: { borderBottomWidth: 1, borderBottomColor: LINE, marginVertical: 14 },

  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 8 },

  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3EC',
    color: BRAND,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 12,
  },

  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', marginBottom: 8 },
  gridLabel: { fontSize: 8, color: MUTED, marginBottom: 2 },
  gridValue: { fontSize: 10, color: INK },

  paragraph: { fontSize: 9.5, color: INK, lineHeight: 1.5 },

  photoSectionHeading: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  photoCell: { width: '33.33%', padding: 3 },
  photoImage: { width: '100%', height: 90, borderRadius: 6, objectFit: 'cover' },
  photoCaption: { fontSize: 7, color: MUTED, marginTop: 3, textAlign: 'center' },

  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 5, marginBottom: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 5 },
  colName: { flex: 3, fontSize: 9 },
  colQty: { flex: 1, fontSize: 9, textAlign: 'center' },
  colCost: { flex: 1.5, fontSize: 9, textAlign: 'right' },
  colTotal: { flex: 1.5, fontSize: 9, textAlign: 'right' },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase' },

  totalsBlock: { marginTop: 10, alignSelf: 'flex-end', width: '55%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: MUTED },
  totalsValue: { fontSize: 9, color: INK },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: INK, paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND },

  timelineRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  timelineDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: BRAND, marginRight: 8 },
  timelineLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', width: 130 },
  timelineDate: { fontSize: 8, color: MUTED },

  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  signatureBlock: { width: '48%' },
  signatureImage: { height: 50, objectFit: 'contain', marginBottom: 4 },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: INK, height: 34, marginBottom: 4 },
  signatureCaption: { fontSize: 8, color: MUTED },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: MUTED },
});

export interface JobReportPhoto {
  url: string;
  stage: Tables<'job_photos'>['stage'];
  takenAt: string;
}

export interface JobReportProps {
  workshop: Tables<'workshops'>;
  job: Tables<'jobs'>;
  photos: JobReportPhoto[];
  parts: Tables<'job_parts'>[];
  statusHistory: Tables<'job_status_history'>[];
  technicianName: string;
  signatureUrl: string | null;
  generatedAt: string;
}

function PhotoStageSection({ title, photos }: { title: string; photos: JobReportPhoto[] }) {
  if (!photos.length) return null;
  return (
    <View>
      <Text style={styles.photoSectionHeading}>{title}</Text>
      <View style={styles.photoGrid}>
        {photos.map((p, i) => (
          <View key={i} style={styles.photoCell}>
            <Image src={p.url} style={styles.photoImage} />
            <Text style={styles.photoCaption}>{formatDate(p.takenAt)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function JobReportDocument({
  workshop,
  job,
  photos,
  parts,
  statusHistory,
  technicianName,
  signatureUrl,
  generatedAt,
}: JobReportProps) {
  const partsTotal = parts.reduce((sum, p) => sum + (p.unit_cost ?? 0) * p.quantity, 0);
  const labourRateNote = job.labour_hours ? `${job.labour_hours} hr${job.labour_hours === 1 ? '' : 's'} logged` : null;

  const before = photos.filter((p) => p.stage === 'before');
  const during = photos.filter((p) => p.stage === 'during');
  const after = photos.filter((p) => p.stage === 'after');

  return (
    <Document title={`AfriJob Report — ${job.vehicle_registration}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.workshopBlock}>
            {workshop.logo_url && <Image src={workshop.logo_url} style={styles.logo} />}
            <View>
              <Text style={styles.workshopName}>{workshop.name}</Text>
              {(workshop.contact_phone || workshop.contact_email) && (
                <Text style={styles.workshopMeta}>
                  {[workshop.contact_phone, workshop.contact_email].filter(Boolean).join('  ·  ')}
                </Text>
              )}
              {workshop.address && <Text style={styles.workshopMeta}>{workshop.address}</Text>}
            </View>
          </View>
          <View style={styles.reportTag}>
            <Text style={styles.reportTagLabel}>JOB REPORT</Text>
            <Text style={styles.reportTagValue}>{job.vehicle_registration}</Text>
          </View>
        </View>

        <Text style={styles.statusPill}>{JOB_STATUS_LABELS[job.status]}</Text>

        {/* Vehicle & job details */}
        <Text style={styles.sectionTitle}>Vehicle & Job Details</Text>
        <View style={styles.grid2}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Make / Model</Text>
            <Text style={styles.gridValue}>{[job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Colour</Text>
            <Text style={styles.gridValue}>{job.vehicle_colour || '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>VIN</Text>
            <Text style={styles.gridValue}>{job.vehicle_vin || '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Odometer</Text>
            <Text style={styles.gridValue}>{job.odometer ? `${job.odometer.toLocaleString()} km` : '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Job Type</Text>
            <Text style={styles.gridValue}>{JOB_TYPE_LABELS[job.job_type]}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Technician</Text>
            <Text style={styles.gridValue}>{technicianName || '—'}</Text>
          </View>
        </View>
        {job.description && (
          <View style={{ marginTop: 2 }}>
            <Text style={styles.gridLabel}>Description / Customer Notes</Text>
            <Text style={styles.paragraph}>{job.description}</Text>
          </View>
        )}

        {/* Photos */}
        {(before.length > 0 || during.length > 0 || after.length > 0) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Photo Record</Text>
            <PhotoStageSection title="Before" photos={before} />
            <PhotoStageSection title="During" photos={during} />
            <PhotoStageSection title="After" photos={after} />
          </>
        )}

        {/* Parts & labour */}
        {(parts.length > 0 || job.labour_hours) && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Parts & Labour</Text>
            {parts.length > 0 && (
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.colName, styles.thText]}>Part</Text>
                  <Text style={[styles.colQty, styles.thText]}>Qty</Text>
                  <Text style={[styles.colCost, styles.thText]}>Unit Cost</Text>
                  <Text style={[styles.colTotal, styles.thText]}>Total</Text>
                </View>
                {parts.map((p) => (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={styles.colName}>{p.part_name}</Text>
                    <Text style={styles.colQty}>{p.quantity}</Text>
                    <Text style={styles.colCost}>{p.unit_cost != null ? formatCurrencyZAR(p.unit_cost) : '—'}</Text>
                    <Text style={styles.colTotal}>{p.unit_cost != null ? formatCurrencyZAR(p.unit_cost * p.quantity) : '—'}</Text>
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
              {labourRateNote && (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Labour</Text>
                  <Text style={styles.totalsValue}>{labourRateNote}</Text>
                </View>
              )}
              {parts.length > 0 && (
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Parts Total</Text>
                  <Text style={styles.grandTotalValue}>{formatCurrencyZAR(partsTotal)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Status timeline */}
        {statusHistory.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Status Timeline</Text>
            {statusHistory.map((h) => (
              <View key={h.id} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <Text style={styles.timelineLabel}>{JOB_STATUS_LABELS[h.to_status]}</Text>
                <Text style={styles.timelineDate}>{formatDate(h.changed_at)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Signatures */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Sign-off</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            {signatureUrl ? (
              <Image src={signatureUrl} style={styles.signatureImage} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureCaption}>Customer signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={{ fontSize: 10, marginBottom: 4 }}>{technicianName || '—'}</Text>
            <Text style={styles.signatureCaption}>Technician</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {formatDate(generatedAt)} · AfriJob Job Report</Text>
          <Text style={styles.footerText}>Generated by AfriJob</Text>
        </View>
      </Page>
    </Document>
  );
}
