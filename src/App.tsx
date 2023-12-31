import { useEffect, useMemo, useState } from "react";
import { AxisOptions, Chart } from "react-charts";
import { z } from "zod";

const datumSchema = z.object({
  Region: z.string(),
  Scenario: z.string(),
  Variable: z.string(),
  Year: z.coerce.number(),
  Value: z.coerce.number(),
});

type Datum = z.infer<typeof datumSchema>;

function useData() {
  const [data, setData] = useState<Datum[]>();

  useEffect(() => {
    fetch("/data.csv")
      .then((response) => response.text())
      .then((csv) => {
        const lines = csv.toString().trim().split(/\r\n/g);
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
    };
  }, [data]);
}

type Filter = {
  dimension: keyof Exclude<ReturnType<typeof useDimensions>, undefined>;
  value: string;
};

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
          return true;
        }

        return datum[dimension] === value;
      });
    });
  }, [data, filters]);
}

function useChartData(data: Datum[] | undefined):
  | {
      label: string;
      data: Datum[];
    }[]
  | undefined {
  return useMemo(() => {
    if (!data) {
      return;
    }

    return Object.entries(
      // @ts-expect-error https://github.com/microsoft/TypeScript/pull/56805
      Object.groupBy(
        data,
        ({ Region, Scenario, Variable }: Datum) =>
          `${Region} - ${Variable} (${Scenario})`,
      ),
    ).map(([Variable, groupedData]) => ({
      label: Variable,
      data: groupedData as Datum[],
    }));
  }, [data]);
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

function Visualization({ data }: { data: Datum[] | undefined }) {
  const chartData = useChartData(data);

  const primaryAxis = useMemo(
    (): AxisOptions<Datum> => ({
      getValue: (datum) => datum.Year,
    }),
    [],
  );

  const secondaryAxes = useMemo(
    (): AxisOptions<Datum>[] => [
      {
        getValue: (datum) => datum.Value,
      },
    ],
    [],
  );

  if (!chartData) {
    return null;
  }

  return (
    <Chart
      className="text-white"
      options={{
        data: chartData,
        primaryAxis,
        secondaryAxes,
      }}
    />
  );
}

function App() {
  const data = useData();
  const dimensions = useDimensions(data);

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
  ]);

  const filteredData = useFilteredData(data, filters);

  return (
    <div className="absolute inset-0 flex bg-gray-700 text-white">
      <div className="flex w-full flex-col gap-2 p-2">
        {dimensions && (
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
        )}
        <div className="relative flex-grow">
          <Visualization data={filteredData} />
        </div>
      </div>
    </div>
  );
}

export default App;
