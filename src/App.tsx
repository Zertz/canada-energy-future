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

function useChartData(dimensionData: DimensionData[] = []): {
  label: string;
  data: DimensionData[];
}[] {
  return Object.entries(Object.groupBy(dimensionData, ([type]) => type)).map(
    ([label, data]) => ({
      label,
      data,
    }),
  );
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

  const data = useChartData(dimensionData);

  console.info(data);

  const primaryAxis = useMemo(
    (): AxisOptions<DimensionData> => ({
      getValue: (datum) => datum[1],
    }),
    [],
  );

  const secondaryAxes = useMemo(
    (): AxisOptions<DimensionData>[] => [
      {
        getValue: (datum) => datum[2],
      },
    ],
    [],
  );

  return (
    <div className="absolute inset-0 bg-gray-700 text-white">
      <div className="p-2">
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
        <Chart
          options={{
            data,
            primaryAxis,
            secondaryAxes,
          }}
        />
      </div>
    </div>
  );
}

export default App;
