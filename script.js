// Financial calculation functions
function calculateAnnuityPayment(principal, interestRate, years) {
    // Convert interest rate from percentage to decimal (e.g., 5 -> 0.05)
    const r = interestRate / 100;
    
    // Handle edge cases
    if (r === 0) return principal / years;
    if (years <= 0) return 0;

    try {
        // Calculate using the formula: A = P * [r(1 + r)^n] / [(1 + r)^n – 1]
        const rPlusOne = 1 + r;
        const rPlusOnePowN = Math.pow(rPlusOne, years);
        const numerator = r * rPlusOnePowN;
        const denominator = rPlusOnePowN - 1;
        
        const annualPayment = principal * (numerator / denominator);
        
        // Validate the result
        if (isNaN(annualPayment) || !isFinite(annualPayment)) {
            console.error('Invalid annuity payment calculation result');
            return 0;
        }
        
        return annualPayment;
    } catch (error) {
        console.error('Error calculating annuity payment:', error);
        return 0;
    }
}

function calculateNPV(cashFlows, discountRate) {
    const r = discountRate / 100;  // Convert percentage to decimal
    return cashFlows.reduce((npv, cf, year) => {
        return npv + cf / Math.pow(1 + r, year);
    }, 0);
}

function calculateIRR(cashFlows, precision = 0.0001) {
    // Validate cash flows for IRR calculation
    if (!cashFlows || cashFlows.length < 2 || cashFlows[0] >= 0) {
        console.warn('Invalid cash flows for IRR calculation');
        return 0;
    }

    let low = -0.999999;
    let high = 100;
    let maxIterations = 1000;
    let iteration = 0;
    
    function npvAtRate(rate) {
        return cashFlows.reduce((npv, cf, year) => {
            return npv + cf / Math.pow(1 + rate, year);
        }, 0);
    }
    
    while (iteration < maxIterations) {
        const midRate = (low + high) / 2;
        const npv = npvAtRate(midRate);
        
        if (Math.abs(npv) < precision) {
            return midRate;
        }
        
        if (npv > 0) {
            low = midRate;
        } else {
            high = midRate;
        }
        
        iteration++;
    }
    
    return (low + high) / 2;
}

function calculateLCOE(capex, opexAnnual, energyOutput, projectLife, discountRate) {
    let discountedOpex = 0;
    let discountedEnergy = 0;
    const r = discountRate / 100;
    
    for (let t = 1; t <= projectLife; t++) {
        discountedOpex += opexAnnual / Math.pow(1 + r, t);
        discountedEnergy += energyOutput / Math.pow(1 + r, t);
    }
    
    return (capex + discountedOpex) / discountedEnergy;
}

// SVG Chart functions
function createSVGChart(data, container) {
    const svg = document.getElementById(container);
    const width = svg.clientWidth - 60;
    const height = svg.clientHeight - 60;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    
    // Clear previous content
    svg.innerHTML = '';
    
    // Find min and max values
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;
    
    // Calculate scales
    const xScale = width / (data.length - 1);
    const yScale = height / (range || 1);
    
    // Create path
    const points = data.map((d, i) => {
        const x = margin.left + (i * xScale);
        const y = margin.top + height - ((d.value - minValue) * yScale);
        return `${x},${y}`;
    }).join(' ');
    
    // Draw axes
    const xAxis = `<line x1="${margin.left}" y1="${margin.top + height}" x2="${margin.left + width}" y2="${margin.top + height}" stroke="black" />`;
    const yAxis = `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + height}" stroke="black" />`;
    
    // Draw grid lines
    const gridLines = [];
    for (let i = 0; i <= 5; i++) {
        const y = margin.top + (height * i / 5);
        gridLines.push(`<line x1="${margin.left}" y1="${y}" x2="${margin.left + width}" y2="${y}" stroke="#ddd" stroke-dasharray="5,5" />`);
        const value = Math.round(maxValue - (range * i / 5));
        gridLines.push(`<text x="${margin.left - 10}" y="${y}" text-anchor="end" alignment-baseline="middle">${value}</text>`);
    }
    
    // Draw x-axis labels
    const xLabels = data.map((d, i) => {
        const x = margin.left + (i * xScale);
        return `<text x="${x}" y="${margin.top + height + 20}" text-anchor="middle">${d.year}</text>`;
    });
    
    // Create the chart
    svg.innerHTML = `
        ${gridLines.join('')}
        ${xAxis}
        ${yAxis}
        ${xLabels.join('')}
        <polyline
            fill="none"
            stroke="#3498db"
            stroke-width="2"
            points="${points}"
        />
        ${data.map((d, i) => {
            const x = margin.left + (i * xScale);
            const y = margin.top + height - ((d.value - minValue) * yScale);
            return `<circle cx="${x}" cy="${y}" r="4" fill="#3498db" />`;
        }).join('')}
    `;
}

// Store the latest calculation results globally
let fullTableData = null;

// Calculate detailed financial data
function calculateDetailedFinancials(inputs) {
    try {
        console.log('Starting detailed financial calculations with inputs:', inputs);
        
        const {
            energyOutput,
            capex,
            opexPercent,
            projectLife,
            discountRate,
            financeTerm,
            debtEquityRatio,
            interestRate,
            tariff,
            rec,
            developmentTime
        } = inputs;

        // Validate inputs
        if (financeTerm <= 0 || financeTerm > projectLife) {
            console.error('Invalid finance term');
            return null;
        }

        // Basic calculations
        const annualRevenue = energyOutput * (tariff + rec);
        const opexAnnual = capex * (opexPercent / 100);
        const debtRatio = debtEquityRatio / 100;
        const equityRatio = 1 - debtRatio;
        const debtAmount = capex * debtRatio;
        const equityAmount = capex * equityRatio;

        // Calculate annual debt payment
        const annualDebtPayment = calculateAnnuityPayment(debtAmount, interestRate, financeTerm);

        // Initialize tracking variables
        let detailedRows = [];
        let projectCashFlows = [-capex];
        let equityCashFlows = [-equityAmount];
        let remainingDebt = debtAmount;
        let cumulativeUndiscountedCash = -equityAmount;
        let cumulativeDiscountedCash = -equityAmount;

        // Year 0 (initial investment)
        detailedRows.push({
            year: 0,
            capex: capex,
            opex: 0,
            revenue: 0,
            debtRepayment: 0,
            principalRepayment: 0,
            interestPayment: 0,
            remainingDebt: debtAmount,
            netCashFlow: -capex,
            equityCashFlow: -equityAmount,
            discountedEquityCashFlow: -equityAmount,
            cumulativeDiscountedCash: cumulativeDiscountedCash
        });

        // Track total equity NPV
        let equityNPV = -equityAmount;

        // Operational years
        for (let year = 1; year <= projectLife; year++) {
            let debtRepayment = 0;
            let principalRepayment = 0;
            let interestPayment = 0;

            // Calculate debt service if within finance term
            if (year <= financeTerm && remainingDebt > 0) {
                debtRepayment = annualDebtPayment;
                interestPayment = remainingDebt * (interestRate / 100);
                principalRepayment = debtRepayment - interestPayment;

                // Handle final payment adjustment if needed
                if (remainingDebt < principalRepayment) {
                    principalRepayment = remainingDebt;
                    interestPayment = remainingDebt * (interestRate / 100);
                    debtRepayment = principalRepayment + interestPayment;
                }

                remainingDebt = Math.max(0, remainingDebt - principalRepayment);
            }

            // Calculate project cash flow
            const projectCashFlow = annualRevenue - opexAnnual;
            
            // Calculate equity cash flow (project cash flow minus debt service)
            const equityCashFlow = projectCashFlow - debtRepayment;
            
            // Calculate discounted equity cash flow
            const discountedEquityCashFlow = equityCashFlow / Math.pow(1 + discountRate / 100, year);
            
            // Update cumulative discounted cash (equity NPV)
            equityNPV += discountedEquityCashFlow;
            
            // Store cash flows for IRR calculations
            projectCashFlows.push(projectCashFlow);
            equityCashFlows.push(equityCashFlow);

            detailedRows.push({
                year,
                capex: 0,
                opex: opexAnnual,
                revenue: annualRevenue,
                debtRepayment,
                principalRepayment,
                interestPayment,
                remainingDebt,
                netCashFlow: projectCashFlow,
                equityCashFlow,
                discountedEquityCashFlow,
                cumulativeDiscountedCash: equityNPV
            });
        }

        // Calculate financial metrics
        const projectNPV = calculateNPV(projectCashFlows, discountRate);
        const projectIRR = calculateIRR(projectCashFlows) * 100;
        const equityIRR = calculateIRR(equityCashFlows) * 100;
        const lcoe = calculateLCOE(capex, opexAnnual, energyOutput, projectLife, discountRate);

        // Store results in the format expected by export functions
        const results = {
            inputs: {
                energyOutput,
                capex,
                opexPercent,
                projectLife,
                developmentTime,
                discountRate,
                financeTerm,
                debtEquityRatio,
                interestRate,
                tariff,
                rec
            },
            metrics: {
                lcoe,
                equityNPV,
                equityIRR,
                projectNPV,
                projectIRR
            },
            detailedRows
        };

        // Store results globally for export functions
        window.fullTableData = results;

        return results;

    } catch (error) {
        console.error('Error in calculateDetailedFinancials:', error);
        throw error;
    }
}

// Format currency values with 2 decimal places
function formatCurrency(value) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Format decimal values with 2 decimal places
function formatDecimal(value) {
    return new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Format percentage values with 2 decimal places
function formatPercent(value) {
    return new Intl.NumberFormat('en-AU', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value / 100);
}

// Generate and download CSV
function downloadFinancialTable() {
    // Check if data exists and log its state
    console.log('Attempting CSV export with data:', window.fullTableData);
    
    if (!window.fullTableData) {
        console.error('No financial data available for export');
        alert('No data available for export. Please calculate results first.');
        return;
    }

    try {
        // Helper function to format numbers for CSV (plain numbers, no formatting)
        function formatNumberForCSV(value) {
            if (value === undefined || value === null) return '0';
            // Convert to number and format with fixed decimal places, no thousands separator
            return Number(value).toFixed(2);
        }

        // Create summary rows (two columns only: Field, Value)
        const summaryRows = [
            ['Project Summary'],
            ['Energy Output (MWh/year),' + formatNumberForCSV(window.fullTableData.inputs.energyOutput)],
            ['CAPEX (AUD),' + formatNumberForCSV(window.fullTableData.inputs.capex)],
            ['OPEX (% of CAPEX),' + formatNumberForCSV(window.fullTableData.inputs.opexPercent)],
            ['Project Life (years),' + window.fullTableData.inputs.projectLife],
            ['Development Time (years),' + formatNumberForCSV(window.fullTableData.inputs.developmentTime)],
            ['Discount Rate (%),' + formatNumberForCSV(window.fullTableData.inputs.discountRate)],
            ['Finance Term (years),' + window.fullTableData.inputs.financeTerm],
            ['Debt/Equity Ratio (%),' + formatNumberForCSV(window.fullTableData.inputs.debtEquityRatio)],
            ['Interest Rate (%),' + formatNumberForCSV(window.fullTableData.inputs.interestRate)],
            ['Tariff (AUD/MWh),' + formatNumberForCSV(window.fullTableData.inputs.tariff)],
            ['REC Value (AUD/MWh),' + formatNumberForCSV(window.fullTableData.inputs.rec)],
            [''],
            ['Key Metrics'],
            ['LCOE (AUD/MWh),' + formatNumberForCSV(window.fullTableData.metrics.lcoe)],
            ['Equity NPV (AUD),' + formatNumberForCSV(window.fullTableData.metrics.equityNPV)],
            ['Equity IRR (%),' + formatNumberForCSV(window.fullTableData.metrics.equityIRR)],
            ['Project NPV (AUD),' + formatNumberForCSV(window.fullTableData.metrics.projectNPV)],
            ['Project IRR (%),' + formatNumberForCSV(window.fullTableData.metrics.projectIRR)],
            [''],
            ['']  // Extra blank line before table
        ];

        // Define table headers
        const tableHeaders = [
            'Year',
            'CAPEX',
            'Revenue',
            'OPEX',
            'Debt Payment',
            'Principal',
            'Interest',
            'Net Cash Flow',
            'Discounted Cash Flow',
            'Cumulative Undiscounted Cash',
            'Cumulative Discounted Cash (NPV)'
        ].join(',');

        // Initialize cumulative cash tracking
        let cumulativeUndiscounted = 0;
        let cumulativeDiscounted = 0;

        // Generate detailed rows with consistent columns
        const detailedRows = window.fullTableData.detailedRows.map(row => {
            // Calculate cumulative values
            const netCashFlow = row.netCashFlow;
            const discountedCashFlow = row.discountedEquityCashFlow;
            cumulativeUndiscounted += netCashFlow;
            cumulativeDiscounted += discountedCashFlow;

            return [
                row.year,
                formatNumberForCSV(row.capex),
                formatNumberForCSV(row.revenue),
                formatNumberForCSV(row.opex),
                formatNumberForCSV(row.debtRepayment),
                formatNumberForCSV(row.principalRepayment),
                formatNumberForCSV(row.interestPayment),
                formatNumberForCSV(netCashFlow),
                formatNumberForCSV(discountedCashFlow),
                formatNumberForCSV(cumulativeUndiscounted),
                formatNumberForCSV(cumulativeDiscounted)
            ].join(',');
        });

        // Combine all content
        const csvContent = [
            ...summaryRows,           // Summary section
            tableHeaders,             // Table headers
            ...detailedRows          // Data rows
        ].join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'financial_analysis.csv';
        document.body.appendChild(link); // Needed for Firefox
        link.click();
        document.body.removeChild(link); // Clean up

        console.log('CSV export completed successfully');
    } catch (error) {
        console.error('Error during CSV export:', error);
        alert('An error occurred while creating the CSV file. Please check the console for details.');
    }
}

// Add PDF export function
function exportSummaryPDF() {
    console.log('Attempting PDF export with data:', window.fullTableData);
    
    if (!window.fullTableData) {
        console.error('No data available for PDF export');
        alert('No data available for export. Please calculate results first.');
        return;
    }

    try {
        // Create new jsPDF instance
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            throw new Error('jsPDF library not loaded');
        }
        
        const doc = new jsPDF();

        // Set initial position
        let y = 20;

        // Get project name
        const projectName = document.getElementById('projectName').value.trim() || 'Untitled Project';

        // Add title with project name
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`WSE Project Financial Analysis: ${projectName}`, doc.internal.pageSize.width / 2, y, { align: 'center' });
        
        // Add date
        y += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width / 2, y, { align: 'center' });

        // Project Inputs table
        y += 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Project Inputs', 14, y);

        const inputData = [
            ['Energy Output', `${formatDecimal(window.fullTableData.inputs.energyOutput)} MWh/year`],
            ['CAPEX', formatCurrency(window.fullTableData.inputs.capex)],
            ['OPEX', `${formatDecimal(window.fullTableData.inputs.opexPercent)}% of CAPEX`],
            ['Project Life', `${window.fullTableData.inputs.projectLife} years`],
            ['Development Time', `${formatDecimal(window.fullTableData.inputs.developmentTime)} years`],
            ['Discount Rate', `${formatDecimal(window.fullTableData.inputs.discountRate)}%`],
            ['Finance Term', `${window.fullTableData.inputs.financeTerm} years`],
            ['Debt/Equity Ratio', `${formatDecimal(window.fullTableData.inputs.debtEquityRatio)}%`],
            ['Interest Rate', `${formatDecimal(window.fullTableData.inputs.interestRate)}%`],
            ['Tariff', `${formatCurrency(window.fullTableData.inputs.tariff)}/MWh`],
            ['REC Value', `${formatCurrency(window.fullTableData.inputs.rec)}/MWh`]
        ];

        y += 5;
        doc.autoTable({
            startY: y,
            head: [['Parameter', 'Value']],
            body: inputData,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255 },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 70, halign: 'right' }
            }
        });

        // Financial Metrics table
        y = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Financial Metrics', 14, y);

        const metricsData = [
            ['LCOE', `${formatCurrency(window.fullTableData.metrics.lcoe)}/MWh`],
            ['Project NPV', formatCurrency(window.fullTableData.metrics.projectNPV)],
            ['Project IRR', formatPercent(window.fullTableData.metrics.projectIRR)],
            ['Equity NPV', formatCurrency(window.fullTableData.metrics.equityNPV)],
            ['Equity IRR', formatPercent(window.fullTableData.metrics.equityIRR)]
        ];

        y += 5;
        doc.autoTable({
            startY: y,
            head: [['Metric', 'Value']],
            body: metricsData,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255 },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 70, halign: 'right' }
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(
                'WSE Project Financial Analysis Tool',
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
        }

        // Save the PDF with project name
        doc.save(`${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_financial_analysis.pdf`);
        console.log('PDF export completed successfully');
    } catch (error) {
        console.error('Error during PDF export:', error);
        alert('An error occurred while creating the PDF. Please check the console for details.');
    }
}

// Update the results display
function updateResults(results) {
    try {
        // Validate results object
        if (!results || !results.metrics) {
            throw new Error('Invalid results object');
        }

        // Store results globally for export
        window.fullTableData = results;
        console.log('Stored calculation results globally:', window.fullTableData);

        // Update key metrics with error handling
        const metricsToUpdate = {
            'lcoeValue': results.metrics.lcoe,
            'projectNpvValue': results.metrics.projectNPV,
            'equityNpvValue': results.metrics.equityNPV,
            'projectIrrValue': results.metrics.projectIRR,
            'equityIrrValue': results.metrics.equityIRR
        };

        Object.entries(metricsToUpdate).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`Element not found: ${elementId}`);
                return;
            }

            try {
                if (elementId.includes('Irr')) {
                    element.textContent = formatPercent(value);
                } else if (elementId.includes('lcoe')) {
                    element.textContent = formatCurrency(value);
                } else {
                    element.textContent = formatCurrency(value);
                }
            } catch (formatError) {
                console.error(`Error formatting value for ${elementId}:`, formatError);
                element.textContent = 'Error';
            }
        });

        // Enable and set up export buttons
        const downloadButton = document.getElementById('downloadButton');
        const exportPdfButton = document.getElementById('exportPdfButton');
        
        if (downloadButton) {
            downloadButton.disabled = false;
            downloadButton.onclick = downloadFinancialTable;
        }
        
        if (exportPdfButton) {
            exportPdfButton.disabled = false;
            exportPdfButton.onclick = exportSummaryPDF;
        }

        console.log('Results display updated successfully');
    } catch (error) {
        console.error('Error updating results display:', error);
        alert('An error occurred while displaying the results. Please check the console for details.');
    }
}

// Form submission handler
document.getElementById('projectForm').addEventListener('submit', function(e) {
    e.preventDefault();

    try {
        console.log('Form submitted, gathering inputs...');
        const inputs = {
            energyOutput: parseFloat(document.getElementById('energyOutput').value),
            capex: parseFloat(document.getElementById('capex').value),
            opexPercent: parseFloat(document.getElementById('opexPercent').value),
            projectLife: parseInt(document.getElementById('projectLife').value),
            developmentTime: parseFloat(document.getElementById('developmentTime').value),
            discountRate: parseFloat(document.getElementById('discountRate').value),
            financeTerm: parseInt(document.getElementById('financeTerm').value),
            debtEquityRatio: parseFloat(document.getElementById('debtEquityRatio').value),
            interestRate: parseFloat(document.getElementById('interestRate').value),
            tariff: parseFloat(document.getElementById('tariff').value),
            rec: parseFloat(document.getElementById('rec').value)
        };

        // Validate all inputs are numbers
        Object.entries(inputs).forEach(([key, value]) => {
            if (isNaN(value)) {
                throw new Error(`Invalid value for ${key}: ${value}`);
            }
        });

        console.log('Inputs validated:', inputs);

        // Calculate and update results
        console.log('Calculating financial metrics...');
        const results = calculateDetailedFinancials(inputs);
        
        if (results) {
            console.log('Calculation successful, updating display...');
            updateResults(results);
            console.log('Results updated successfully');
        } else {
            console.error('Calculation failed - no results returned');
            alert('Failed to calculate results. Please check your inputs and try again.');
        }
    } catch (error) {
        console.error('Error in form submission:', error);
        alert('An error occurred while processing your inputs. Please check the console for details.');
    }
});

// Local Storage Functions
function saveFormValues() {
    const formData = {
        energyOutput: document.getElementById('energyOutput').value,
        capex: document.getElementById('capex').value,
        opexPercent: document.getElementById('opexPercent').value,
        projectLife: document.getElementById('projectLife').value,
        developmentTime: document.getElementById('developmentTime').value,
        discountRate: document.getElementById('discountRate').value,
        financeTerm: document.getElementById('financeTerm').value,
        debtEquityRatio: document.getElementById('debtEquityRatio').value,
        interestRate: document.getElementById('interestRate').value,
        tariff: document.getElementById('tariff').value,
        rec: document.getElementById('rec').value
    };

    localStorage.setItem('wseFinancialData', JSON.stringify(formData));
}

function loadFormValues() {
    const savedData = localStorage.getItem('wseFinancialData');
    if (savedData) {
        const formData = JSON.parse(savedData);
        
        // Load values into form fields
        Object.keys(formData).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = formData[key];
            }
        });
    }
}

// Clear form values and results
function clearFormValues() {
    try {
        console.log('Clearing all form values and results...');
        
        // Clear form fields
        document.getElementById('projectForm').reset();
        document.getElementById('projectName').value = '';
        
        // Reset result displays
        const elementsToReset = [
            'lcoeValue',
            'projectNpvValue',
            'equityNpvValue',
            'projectIrrValue',
            'equityIrrValue'
        ];
        
        elementsToReset.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '-';
            }
        });
        
        // Disable export buttons
        const downloadButton = document.getElementById('downloadButton');
        const exportPdfButton = document.getElementById('exportPdfButton');
        
        if (downloadButton) {
            downloadButton.disabled = true;
        }
        
        if (exportPdfButton) {
            exportPdfButton.disabled = true;
        }
        
        // Clear current project display
        updateCurrentProjectDisplay('');
        
        // Remove active state from sidebar
        updateActiveProject('');
        
        // Reset global data
        fullTableData = null;
        
        console.log('Form and results cleared successfully');
    } catch (error) {
        console.error('Error clearing form values:', error);
        alert('There was an error clearing the form. Please try again.');
    }
}

// Project Management Functions
function saveProject() {
    const projectName = document.getElementById('projectName').value.trim();
    
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }
    
    // Get all form values
    const formData = {
        projectName,
        energyOutput: document.getElementById('energyOutput').value,
        capex: document.getElementById('capex').value,
        opexPercent: document.getElementById('opexPercent').value,
        projectLife: document.getElementById('projectLife').value,
        developmentTime: document.getElementById('developmentTime').value,
        discountRate: document.getElementById('discountRate').value,
        financeTerm: document.getElementById('financeTerm').value,
        debtEquityRatio: document.getElementById('debtEquityRatio').value,
        interestRate: document.getElementById('interestRate').value,
        tariff: document.getElementById('tariff').value,
        rec: document.getElementById('rec').value
    };
    
    // Get existing projects or initialize empty object
    const savedProjects = JSON.parse(localStorage.getItem('wseProjects') || '{}');
    
    // Add/update project
    savedProjects[projectName] = formData;
    
    // Save back to localStorage
    localStorage.setItem('wseProjects', JSON.stringify(savedProjects));
    
    // Update projects list
    updateProjectsList();
    
    // Update current project display
    updateCurrentProjectDisplay(projectName);
}

function loadProject(projectName) {
    const savedProjects = JSON.parse(localStorage.getItem('wseProjects') || '{}');
    const project = savedProjects[projectName];
    
    if (!project) {
        console.error('Project not found:', projectName);
        return;
    }
    
    // Fill form with project data
    document.getElementById('projectName').value = project.projectName;
    document.getElementById('energyOutput').value = project.energyOutput;
    document.getElementById('capex').value = project.capex;
    document.getElementById('opexPercent').value = project.opexPercent;
    document.getElementById('projectLife').value = project.projectLife;
    document.getElementById('developmentTime').value = project.developmentTime;
    document.getElementById('discountRate').value = project.discountRate;
    document.getElementById('financeTerm').value = project.financeTerm;
    document.getElementById('debtEquityRatio').value = project.debtEquityRatio;
    document.getElementById('interestRate').value = project.interestRate;
    document.getElementById('tariff').value = project.tariff;
    document.getElementById('rec').value = project.rec;
    
    // Update current project display
    updateCurrentProjectDisplay(projectName);
    
    // Update active state in sidebar
    updateActiveProject(projectName);
}

function updateProjectsList() {
    const projectsList = document.getElementById('projectsList');
    const savedProjects = JSON.parse(localStorage.getItem('wseProjects') || '{}');
    
    // Clear current list
    projectsList.innerHTML = '';
    
    // Add each project to the list
    Object.keys(savedProjects).sort().forEach(projectName => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.onclick = () => loadProject(projectName);
        
        // Create project name span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'project-name';
        nameSpan.textContent = projectName;
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-project';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Project';
        deleteBtn.onclick = (e) => deleteProject(e, projectName);
        
        // Add elements to project item
        projectItem.appendChild(nameSpan);
        projectItem.appendChild(deleteBtn);
        
        projectsList.appendChild(projectItem);
    });
}

function updateCurrentProjectDisplay(projectName) {
    const display = document.getElementById('currentProjectDisplay');
    if (projectName) {
        display.textContent = `Current Project: ${projectName}`;
        display.style.display = 'block';
    } else {
        display.style.display = 'none';
    }
}

function updateActiveProject(projectName) {
    // Remove active class from all projects
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected project
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        if (item.textContent === projectName) {
            item.classList.add('active');
        }
    });
}

function deleteProject(event, projectName) {
    // Prevent the click from triggering the project load
    event.stopPropagation();
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the project "${projectName}"?`)) {
        return;
    }
    
    // Get existing projects
    const savedProjects = JSON.parse(localStorage.getItem('wseProjects') || '{}');
    
    // Delete the project
    delete savedProjects[projectName];
    
    // Save back to localStorage
    localStorage.setItem('wseProjects', JSON.stringify(savedProjects));
    
    // Update projects list
    updateProjectsList();
    
    // If the deleted project was the current one, clear the form
    const currentProject = document.getElementById('projectName').value;
    if (currentProject === projectName) {
        clearFormValues();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded, initializing application...');
    
    try {
        // Set up save project button
        const saveProjectButton = document.getElementById('saveProjectButton');
        if (saveProjectButton) {
            saveProjectButton.onclick = saveProject;
        }
        
        // Load saved projects list
        updateProjectsList();
        
        // Set up clear button
        const clearButton = document.getElementById('clearButton');
        if (clearButton) {
            clearButton.onclick = clearFormValues;
        }
        
        // Initially disable export buttons
        const downloadButton = document.getElementById('downloadButton');
        const exportPdfButton = document.getElementById('exportPdfButton');
        
        if (downloadButton) {
            downloadButton.disabled = true;
            downloadButton.onclick = downloadFinancialTable;
        }
        
        if (exportPdfButton) {
            exportPdfButton.disabled = true;
            exportPdfButton.onclick = exportSummaryPDF;
        }
        
        // Verify form exists
        const form = document.getElementById('projectForm');
        if (!form) {
            throw new Error('Project form not found');
        }
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error during application initialization:', error);
        alert('There was an error initializing the application. Please check the console for details.');
    }
}); 