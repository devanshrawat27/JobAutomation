import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export type ResumePdfData = {
  headline?: string;
  summary?: string;
  sections?: Array<{ title: string; lines: Array<{ text: string }> }>;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 40,
    fontSize: 9.5,
    lineHeight: 1.35,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  headline: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  summary: { fontSize: 9.5, color: "#333333", marginBottom: 12 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#7a5a22",
    marginBottom: 5,
  },
  line: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 11, color: "#7a5a22" },
  lineText: { flex: 1 },
  letterSubject: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginBottom: 12 },
  paragraph: { marginBottom: 9 },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    fontSize: 7,
    color: "#888888",
    borderTopWidth: 0.5,
    borderTopColor: "#dddddd",
    paddingTop: 5,
  },
});

function ResumePdf({ data, footer }: { data: ResumePdfData; footer: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.headline ? <Text style={styles.headline}>{data.headline}</Text> : null}
        {data.summary ? <Text style={styles.summary}>{data.summary}</Text> : null}

        {(data.sections ?? []).map((section) => (
          <View key={section.title} style={styles.section} wrap>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lines.map((line, index) => (
              <View key={`${section.title}-${index}`} style={styles.line}>
                <Text style={styles.bullet}>{"\u2022"}</Text>
                <Text style={styles.lineText}>{line.text}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text fixed style={styles.footer}>{footer}</Text>
      </Page>
    </Document>
  );
}

function LetterPdf({ subject, body, footer }: { subject: string; body: string; footer: string }) {
  const paragraphs = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.letterSubject}>{subject}</Text>
        {paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>{paragraph}</Text>
        ))}
        <Text fixed style={styles.footer}>{footer}</Text>
      </Page>
    </Document>
  );
}

export async function renderResumePdf(data: ResumePdfData, footer: string): Promise<Buffer> {
  return renderToBuffer(<ResumePdf data={data} footer={footer} />);
}

export async function renderCoverLetterPdf(subject: string, body: string, footer: string): Promise<Buffer> {
  return renderToBuffer(<LetterPdf subject={subject} body={body} footer={footer} />);
}
