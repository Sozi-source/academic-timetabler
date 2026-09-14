import zipfile
import xml.etree.ElementTree as ET
import os

namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def extract_docx_to_markdown(docx_path, out_md_path):
    if not os.path.exists(docx_path):
        print(f"File not found: {docx_path}")
        return
    
    print(f"Extracting {docx_path} -> {out_md_path}...")
    with zipfile.ZipFile(docx_path, 'r') as z:
        xml_content = z.read('word/document.xml')
    
    root = ET.fromstring(xml_content)
    body = root.find('w:body', namespaces)
    if body is None:
        print("No body found")
        return
    
    output_lines = []
    
    for elem in body:
        tag = elem.tag.split('}')[-1]
        if tag == 'p':
            texts = [node.text for node in elem.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
            text = "".join(texts).strip()
            if text:
                output_lines.append(text)
        elif tag == 'tbl':
            output_lines.append("\n--- TABLE START ---")
            for row in elem.findall('w:tr', namespaces):
                row_cells = []
                for cell in row.findall('w:tc', namespaces):
                    cell_texts = []
                    for p in cell.findall('w:p', namespaces):
                        p_texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                        pt = "".join(p_texts).strip()
                        if pt:
                            cell_texts.append(pt)
                    row_cells.append(" | ".join(cell_texts))
                output_lines.append(" [ROW] " + " /// ".join(row_cells))
            output_lines.append("--- TABLE END ---\n")
            
    with open(out_md_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(output_lines))
    print(f"Done: {out_md_path} ({len(output_lines)} lines, {os.path.getsize(out_md_path)} bytes)")

extract_docx_to_markdown("Module_I_Curriculum.docx", "module_1_extracted.md")
extract_docx_to_markdown("Module_III_curriculum.docx", "module_3_extracted.md")
