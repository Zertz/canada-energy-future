import { useEffect, useMemo, useRef, useState } from "react";
import { AxisOptions, Chart } from "react-charts";
import { z } from "zod";

const labelSchema = z.enum(["Scenarios", "Regions"]);

type Label = z.infer<typeof labelSchema>;

const dimensionsSchema = z.record(labelSchema, z.array(z.string()));

type Dimensions = z.infer<typeof dimensionsSchema>;

const dimensionDataSchema = z.tuple([z.string(), z.number(), z.number()]);

type DimensionData = z.infer<typeof dimensionDataSchema>;

function useDimensions() {
  const [dimensions, setDimensions] = useState<Dimensions>({
    Scenarios: [],
    Regions: [],
  });

  useEffect(() => {
    fetch("/dimensions.json", {
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((json) => setDimensions(dimensionsSchema.parse(json)))
      .catch(console.error);
  }, []);

  return dimensions;
}

function useDimensionData({
  Scenarios,
  Regions,
}: Record<Label, string | undefined>) {
  const [dimensionData, setDimensionData] = useState<DimensionData[]>();

  const dimensionDataCache = useRef<
    Record<`${string}.${string}`, DimensionData[]>
  >({});

  useEffect(() => {
    if (!Scenarios || !Regions) {
      return;
    }

    const cachedData = dimensionDataCache.current[`${Scenarios}.${Regions}`];

    if (cachedData) {
      setDimensionData(cachedData);

      return;
    }

    fetch(`/${Scenarios}/${Regions}.json`, {
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then(z.array(dimensionDataSchema).parse)
      .then((dimensionData) => {
        dimensionDataCache.current[`${Scenarios}.${Regions}`] = dimensionData;

        setDimensionData(dimensionData);
      })
      .catch(console.error);
  }, [Regions, Scenarios]);

  return dimensionData;
}

function useChartData(dimensionData: ReturnType<typeof useDimensionData>):
  | {
      label: string;
      data: {
        year: number;
        value: number;
      }[];
    }[]
  | undefined {
  return useMemo(() => {
    if (!dimensionData) {
      return;
    }

    return Object.entries(Object.groupBy(dimensionData, ([type]) => type)).map(
      ([label, data]) => ({
        label,
        data: (data as DimensionData[]).map(([, year, value]) => ({
          year,
          value,
        })),
      }),
    );
  }, [dimensionData]);
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
  dimensionData,
}: {
  dimensionData: ReturnType<typeof useDimensionData>;
}) {
  const data = useChartData(dimensionData);

  const primaryAxis = useMemo(
    (): AxisOptions<{ year: number; value: number }> => ({
      getValue: (datum) => datum.year,
    }),
    [],
  );

  const secondaryAxes = useMemo(
    (): AxisOptions<{ year: number; value: number }>[] => [
      {
        getValue: (datum) => datum.value,
      },
    ],
    [],
  );

  if (!data) {
    return null;
  }

  return (
    <Chart
      className="text-white"
      options={{
        data,
        primaryAxis,
        secondaryAxes,
      }}
    />
  );
}

function App() {
  const dimensions = useDimensions();

  const [selectedDimensions, setSelectedDimensions] = useState<
    Record<Label, string | undefined>
  >({
    Scenarios: undefined,
    Regions: undefined,
  });

  useEffect(() => {
    const defaultScenario = dimensions.Scenarios?.at(0);
    const defaultRegion = dimensions.Regions?.at(0);

    setSelectedDimensions({
      Scenarios: defaultScenario,
      Regions: defaultRegion,
    });
  }, [dimensions]);

  const dimensionData = useDimensionData(selectedDimensions);

  return (
    <div className="absolute inset-0 flex bg-gray-700 text-white">
      <div className="flex w-full flex-col gap-2 p-2">
        <div className="flex gap-2">
          {Object.entries(dimensions).map(([label, options]) => (
            <Select
              key={label}
              label={label}
              options={options}
              setValue={(value) => {
                setSelectedDimensions((selectedDimensions) => ({
                  ...selectedDimensions,
                  [label]: value,
                }));
              }}
              value={selectedDimensions[label as Label]}
            />
          ))}
        </div>
        <div className="relative flex-grow">
          <Visualization dimensionData={dimensionData} />
        </div>
      </div>
    </div>
  );
}

export default App;
