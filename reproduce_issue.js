
const hybridGridCategories = [
    { title: "GridCat", elements: [{ name: "GridEl1" }] }
];
const hybridTextCategories = [
    { title: "TextCat", elements: [{ name: "TextEl1" }] }
];
const phaseOrder = ["text", "grid"];

const hybridGridData = JSON.stringify(hybridGridCategories);
const hybridTextData = JSON.stringify(hybridTextCategories);

let elementColumns = [];

phaseOrder.forEach(phase => {
    if (phase === 'grid' && hybridGridData) {
        try {
            const categories = JSON.parse(hybridGridData);
            categories.forEach((category, catIdx) => {
                if (category.elements && Array.isArray(category.elements)) {
                    category.elements.forEach((element, elIdx) => {
                        const categoryName = category.title || `Category_${catIdx + 1}`;
                        const elementName = element.name || `Element_${elIdx + 1}`;
                        const columnName = `Grid: ${categoryName}-${elementName}`;
                        elementColumns.push(columnName);
                    });
                }
            });
        } catch (e) {
            console.warn('Failed to parse grid', e);
        }
    } else if (phase === 'text' && hybridTextData) {
        try {
            const categories = JSON.parse(hybridTextData);
            categories.forEach((category, catIdx) => {
                if (category.elements && Array.isArray(category.elements)) {
                    category.elements.forEach((element, elIdx) => {
                        const categoryName = category.title || `Category_${catIdx + 1}`;
                        const statementContent = element.name || `Statement_${elIdx + 1}`;
                        const columnName = `Text: ${categoryName}-${statementContent}`;
                        elementColumns.push(columnName);
                    });
                }
            });
        } catch (e) {
            console.warn('Failed to parse text', e);
        }
    }
});

console.log("Columns:", elementColumns);
