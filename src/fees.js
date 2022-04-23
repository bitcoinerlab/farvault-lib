/**
 * Return an array of precomputed feeRates within a range.
 *
 * It's probably a good idea to keep default values.
 *
 * Maybe you only want to change the number of samples.
 * @param {Object} parameters
 * @param {number} parameters.minSatsPerByte The minimum fee rate.  
 * Default value is 1, which is Bitcoin core's default policy for minimum relay fee.  
 * It should be greater than `0` and lower than `1E6`.  
 * **NOTE**: it doesn't make sense to make it lower than 1 for the mainnet.  
 * @param {number} parameters.maxSatsPerByte The maximum fee rate.  
 * Default value is `10000`, which is 10 times larger than 22-dec-2017 fee rates.   
 * It should be greater than minSatsPerByte and lower than `1E6`.
 * @param {number} parameters.samples The number of samples, that is, the length of the returned array.  
 * Must be an integer. Default value is `100`. Accepted values go from `2` to `1E5`.
 * @param {boolean} parameters.logScale Whether to use logarithmic (`true`) or lineal scale (`false`).  
 * Default is `true`, that is to use logarithmic scale to give more granularity to lower fee rates.
 * @returns {Array} An array of numbers containing the sampled fee rates.
 */
export function feeRateSampling({
  minSatsPerByte = 1,
  maxSatsPerByte = 10000,
  samples = 100,
  logScale = true
} = {}) {
  const result = [];

  if (
    typeof minSatsPerByte !== 'number' ||
    minSatsPerByte < 0 ||
    minSatsPerByte > 1e6
  )
    throw new Error('Invalid minSatsPerByte');
  if (
    typeof maxSatsPerByte !== 'number' ||
    maxSatsPerByte <= minSatsPerByte ||
    maxSatsPerByte > 1e6
  )
    throw new Error('Invalid maxSatsPerByte');
  if (!Number.isSafeInteger(samples) || samples < 2 || samples > 1e5)
    throw new Error('Invalid samples');
  if (typeof logScale !== 'boolean') throw new Error('Invalid logScale');

  if (logScale) {
    result.push(minSatsPerByte);
    let f = Math.pow(maxSatsPerByte / minSatsPerByte, 1 / --samples);
    while (--samples) result.push(result[result.length - 1] * f);
    result.push(maxSatsPerByte);
  } else {
    for (
      let i = minSatsPerByte;
      i <= maxSatsPerByte;
      i += (maxSatsPerByte - minSatsPerByte) / (samples - 1)
    )
      result.push(i);
  }

  return result;
}
