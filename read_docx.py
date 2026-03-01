import zipfile
import xml.etree.ElementTree as ET

def read_docx(file_path):
    z = zipfile.ZipFile(file_path)
    xml_content = z.read('word/document.xml')
    tree = ET.fromstring(xml_content)
    namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    paragraphs = []
    for p in tree.iter(f"{{{namespace['w']}}}p"):
        texts = [node.text for node in p.iter(f"{{{namespace['w']}}}t") if node.text]
        if texts:
            paragraphs.append("".join(texts))
    
    with open('extracted_text.txt', 'w', encoding='utf-8') as f:
        for p in paragraphs:
            f.write(p + '\n')

read_docx(r'c:\Users\juan luis\Downloads\guaicaipuro-react - copia\Keymaster-Parte9-Frontend-DesignSystem.docx')
