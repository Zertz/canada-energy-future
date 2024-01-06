import { useEffect, useMemo, useState } from "react";
import { AxisOptions, Chart, UserSerie } from "react-charts";
import { z } from "zod";

const datumSchema = z.object({
  Region: z.string(),
  Scenario: z.string(),
  Variable: z.string(),
  Year: z.coerce.number(),
  Value: z.coerce.number(),
});

type Datum = z.infer<typeof datumSchema>;
type Dimension = Exclude<keyof Datum, "Value">;

type Filter = {
  dimension: Dimension;
  value: string;
};

function useData() {
  const [data, setData] = useState<Datum[]>();

  useEffect(() => {
    fetch("/data.csv")
      .then((response) => response.text())
      .then((csv) => {
        const lines = csv.toString().trim().split(/\r?\n/g);
        const headers = lines.at(0)?.replace(/"/g, "").split(/,/g);

        if (!headers) {
          throw new Error("Missing headers");
        }

        const data = z.array(datumSchema).parse(
          lines.slice(1).map((line) => {
            return Object.fromEntries(
              line.split(/,/g).map((cell, index) => {
                const header = headers.at(index);

                if (typeof header !== "string") {
                  throw new Error(
                    `Missing header at index ${index} (${headers.join(", ")})`,
                  );
                }

                if (cell.startsWith('"') && cell.endsWith('"')) {
                  return [header, cell.substring(1, cell.length - 1)];
                }

                return [header, cell];
              }),
            );
          }),
        );

        setData(data.sort((a, b) => a.Year - b.Year));
      })
      .catch(alert);
  }, []);

  return data;
}

function useDimensions(data: Datum[] | undefined) {
  return useMemo(() => {
    if (!data) {
      return;
    }

    return {
      Scenario: ["All"].concat(
        Array.from(new Set(data.map(({ Scenario }) => Scenario))).sort(),
      ),
      Region: ["All"].concat(
        Array.from(new Set(data.map(({ Region }) => Region))).sort(),
      ),
      Variable: ["All"].concat(
        Array.from(new Set(data.map(({ Variable }) => Variable))).sort(),
      ),
      Year: ["All"].concat(
        Array.from(new Set(data.map(({ Year }) => `${Year}`))).sort(),
      ),
    };
  }, [data]);
}

function useFilteredData(data: Datum[] | undefined, filters: Filter[]) {
  return useMemo(() => {
    if (!data) {
      return;
    }

    if (filters.length === 0) {
      return data;
    }

    return data.filter((datum) => {
      return filters.every(({ dimension, value }) => {
        if (value === "All") {
          return dimension === "Region" && value === "All"
            ? datum.Region !== "Canada"
            : true;
        }

        return `${datum[dimension]}` === value;
      });
    });
  }, [data, filters]);
}

function useChartData(
  data: Datum[] | undefined,
  filters: Filter[],
): UserSerie<Datum>[] | undefined {
  return useMemo(() => {
    if (!data) {
      return;
    }

    const allDimensions = filters
      .filter((filter) => filter.dimension !== "Year" && filter.value === "All")
      .map((filter) => filter.dimension as Exclude<Dimension, "Year">);

    const allRegions = allDimensions.includes("Region");
    const allVariables = allDimensions.includes("Variable");
    const allScenarios = allDimensions.includes("Scenario");

    const groupByFn = ({ Region, Scenario, Variable }: Datum) => {
      return `${allRegions ? Region : ""}${
        allRegions && allVariables ? " - " : ""
      }${allVariables ? Variable : ""}${
        (allRegions || allVariables) && allScenarios
          ? ` (${Scenario})`
          : allScenarios
            ? Scenario
            : ""
      }`;
    };

    return Object.entries(
      // @ts-expect-error https://github.com/microsoft/TypeScript/pull/56805
      Object.groupBy(data, groupByFn),
    ).map(([label, groupedData]) => {
      return {
        label,
        data: groupedData as Datum[],
      };
    });
  }, [data, filters]);
}

function Select({
  label,
  options,
  setValue,
  value,
}: {
  label: string;
  options: string[];
  setValue: (value: string) => void;
  value: string | undefined;
}) {
  return (
    <label key={label} className="flex w-full flex-col gap-1 text-sm font-bold">
      {label}
      <select
        className="rounded p-1 font-normal text-gray-900"
        onChange={({ target: { value } }) => setValue(value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Visualization({
  data,
  filters,
}: {
  data: Datum[] | undefined;
  filters: Filter[];
}) {
  const hasYearFilter = filters.some(
    ({ dimension, value }) => dimension === "Year" && value !== "All",
  );

  const chartData = useChartData(data, filters);

  const primaryAxis = useMemo<AxisOptions<Datum>>(
    () => ({
      getValue: (datum) => (hasYearFilter ? datum.Variable : datum.Year),
    }),
    [hasYearFilter],
  );

  const secondaryAxes = useMemo<AxisOptions<Datum>[]>(
    () => [
      {
        getValue: (datum) => datum.Value,
      },
    ],
    [],
  );

  if (!chartData?.length) {
    return null;
  }

  return (
    <Chart
      options={{
        dark: true,
        data: chartData,
        primaryAxis,
        secondaryAxes,
      }}
    />
  );
}

function Section({
  data,
  dimensions,
}: {
  data: Datum[] | undefined;
  dimensions: ReturnType<typeof useDimensions>;
}) {
  const [filters, setFilters] = useState<Filter[]>([
    {
      dimension: "Scenario",
      value: "Current Measures",
    },
    {
      dimension: "Region",
      value: "All",
    },
    {
      dimension: "Variable",
      value: "All",
    },
    {
      dimension: "Year",
      value: "All",
    },
  ]);

  const filteredData = useFilteredData(data, filters);

  return (
    <section className="flex flex-col gap-2">
      <form>
        {dimensions && (
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">Filters</legend>
            <div className="flex gap-2">
              {Object.entries(dimensions).map(([dimension, options]) => (
                <Select
                  key={dimension}
                  label={dimension}
                  options={options}
                  setValue={(value) => {
                    setFilters((filters) => {
                      return filters
                        .filter((filter) => filter.dimension !== dimension)
                        .concat({
                          dimension: dimension as Filter["dimension"],
                          value,
                        });
                    });
                  }}
                  value={
                    filters.find((filter) => filter.dimension === dimension)
                      ?.value || options[0]
                  }
                />
              ))}
            </div>
          </fieldset>
        )}
      </form>
      <div className="relative flex-grow">
        <Visualization data={filteredData} filters={filters} />
      </div>
    </section>
  );
}

function App() {
  const [rows, setRows] = useState(1);
  const [columns, setColumns] = useState(1);

  const data = useData();
  const dimensions = useDimensions(data);

  return (
    <div className="absolute inset-0 flex bg-gray-700 text-white">
      <div
        className="grid w-full gap-2 p-2"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
      >
        {Array(rows * columns)
          .fill(0)
          .map((_, i) => (
            <Section key={i} data={data} dimensions={dimensions} />
          ))}
      </div>
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          className="z-50 rounded-full bg-gray-300 p-2"
          onClick={() => setRows((rows) => rows + 1)}
        >
          Add row
        </button>
        <button
          className="z-50 rounded-full bg-gray-300 p-2"
          onClick={() => setColumns((columns) => columns + 1)}
        >
          Add column
        </button>
      </div>
    </div>
  );
}

export default App;
