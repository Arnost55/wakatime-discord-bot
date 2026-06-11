import QuickChart from 'quickchart-js';

/**
 * Generate a pie chart as a PNG buffer using QuickChart.
 * Items below 1% of the total are grouped into an "Other" slice.
 *
 * @param dataPoints - Label/value pairs to chart.
 * @returns A PNG buffer of the pie chart.
 */
export function generatePieChart(dataPoints: { label: string; value: number }[]): Promise<Buffer> {
    const total = dataPoints.reduce((s, p) => s + p.value, 0);
    const threshold = 0.01;
    const others: { label: string; value: number }[] = [];
    const main: { label: string; value: number }[] = [];

    for (const point of dataPoints) {
        if (point.value / total < threshold) {
            others.push(point);
        } else {
            main.push(point);
        }
    }

    if (others.length > 0) {
        main.push({ label: 'Other', value: others.reduce((s, p) => s + p.value, 0) });
    }

    const chart = new QuickChart();
    chart.setWidth(650);
    chart.setHeight(650);
    chart.setDevicePixelRatio(2);

    const colours = main.map(() => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`);

    chart.setConfig({
        type: 'outlabeledPie',
        data: {
            labels: main.map((p) => p.label),
            datasets: [
                {
                    data: main.map((p) => p.value),
                    backgroundColor: colours,
                },
            ],
        },
        options: {
            plugins: {
                legend: false,
                outlabels: {
                    stretch: 35,
                    font: {
                        minSize: 12,
                        maxSize: 18,
                    },
                },
            },
        },
    });

    return chart.toBinary();
}

/**
 * Generate a stacked bar chart as a PNG buffer using QuickChart.
 * Each dataset represents a user, each label a category (e.g. language).
 *
 * @param labels   - Category names for the x-axis.
 * @param datasets - Per-user data series to stack in the bars.
 * @returns A PNG buffer of the bar chart.
 */
export function generateBarChart(
    labels: string[],
    datasets: { label: string; data: number[] }[],
): Promise<Buffer> {
    const chart = new QuickChart();
    chart.setWidth(650);
    chart.setHeight(650);
    chart.setDevicePixelRatio(2);

    const colours = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];

    chart.setConfig({
        type: 'bar',
        data: {
            labels,
            datasets: datasets.map((d, i) => ({
                label: d.label,
                data: d.data,
                backgroundColor: colours[i % colours.length],
            })),
        },
        options: {
            legend: {
                labels: { fontColor: '#FFFFFF', fontSize: 14 },
            },
            scales: {
                xAxes: [
                    {
                        stacked: true,
                        ticks: { fontColor: '#FFFFFF', fontSize: 14 },
                        gridLines: { display: false },
                    },
                ],
                yAxes: [
                    {
                        stacked: true,
                        ticks: { fontColor: '#FFFFFF', fontSize: 14 },
                        gridLines: { display: false },
                    },
                ],
            },
        },
    });

    return chart.toBinary();
}
