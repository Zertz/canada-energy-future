import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

const csv = await readFile("electricity-generation-2023.csv");

const lines = csv.toString().trim().split(/\r\n/g);

const headers = lines.at(0).replace(/"/g, "").split(/,/g);

const schema = z.object({
  Region: z.string(),
  Scenario: z.string(),
  Variable: z.string(),
  Year: z.coerce.number(),
  Value: z.coerce.number(),
});

const data = z.array(schema).parse(
  lines.slice(1).map((line) => {
    return Object.fromEntries(
      line.split(/,/g).map((cell, index) => {
        if (cell.startsWith('"') && cell.endsWith('"')) {
          return [headers[index], cell.substring(1, cell.length - 1)];
        }

        return [headers[index], cell];
      }),
    );
  }),
);

const Regions = new Set(data.map(({ Region }) => Region));
const Scenarios = new Set(data.map(({ Scenario }) => Scenario));

for (const Scenario of Scenarios) {
  await mkdir(`public/${Scenario}`, { recursive: true });
}

/**
 * @type Record<string, z.infer<typeof schema>[]>
 */
const dataByRegionAndScenario = Object.groupBy(
  data,
  ({ Region, Scenario }) => `${Region}.${Scenario}`,
);

for (const data of Object.values(dataByRegionAndScenario)) {
  await writeFile(
    `public/${data.at(0).Scenario}/${data.at(0).Region}.json`,
    JSON.stringify(
      data.map(({ Region, Scenario, ...rest }) => Object.values(rest)),
    ),
  );
}

await writeFile(
  "public/dimensions.json",
  JSON.stringify({
    Scenarios: Array.from(Scenarios).sort(),
    Regions: Array.from(Regions).sort(),
  }),
);
