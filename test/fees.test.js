import { feeRateSampling } from '../src/fees';

describe('Fees', () => {
  test('feeRateSampling', () => {
    expect(feeRateSampling({ samples: 10 }).length).toEqual(10);
    expect(feeRateSampling({ samples: 10, logScale: false }).length).toEqual(
      10
    );

    expect(feeRateSampling({ samples: 10 })).toEqual([
      1,
      2.7825594022071245,
      7.74263682681127,
      21.544346900318835,
      59.9484250318941,
      166.81005372000587,
      464.15888336127784,
      1291.5496650148837,
      3593.8136638046267,
      10000
    ]);
    const tenLinear = feeRateSampling({
      samples: 10,
      minSatsPerByte: 0,
      maxSatsPerByte: 9,
      logScale: false
    });
    expect(tenLinear.length).toEqual(10);
    //toBeCloseTo to account for these precission errors: 3.0000000000000004
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(i =>
      expect(i).toBeCloseTo(tenLinear[i], 10)
    );
    expect(() => feeRateSampling({ minSatsPerByte: -0.4 })).toThrow(
      'Invalid minSatsPerByte'
    );
    expect(() => feeRateSampling({ minSatsPerByte: 1e6 + 1 })).toThrow(
      'Invalid minSatsPerByte'
    );
    expect(() =>
      feeRateSampling({ minSatsPerByte: 1, maxSatsPerByte: 1 })
    ).toThrow('Invalid maxSatsPerByte');
    expect(() => feeRateSampling({ maxSatsPerByte: 'a' })).toThrow(
      'Invalid maxSatsPerByte'
    );
    expect(() => feeRateSampling({ maxSatsPerByte: 1e6 + 1 })).toThrow(
      'Invalid maxSatsPerByte'
    );
    expect(() => feeRateSampling({ samples: 0 })).toThrow('Invalid samples');
    expect(() => feeRateSampling({ samples: 1 })).toThrow('Invalid samples');
    expect(() => feeRateSampling({ samples: 'a' })).toThrow('Invalid samples');
    expect(() => feeRateSampling({ samples: 1212312312321 })).toThrow(
      'Invalid samples'
    );
    expect(() => feeRateSampling({ logScale: 1 })).toThrow('Invalid logScale');
  });
});
