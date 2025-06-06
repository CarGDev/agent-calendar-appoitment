// 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144

const getFibonacci = (array, i, k = 1) => {
  if (i === 0) return array
  const sum = array[k] + array[k - 1]
  array.push(sum);
  return getFibonacci(array, i - 1, k + 1);

}

const fibonacci = (num, array = [], i = 1) => {
  if (num < 1) return array;
  if (num === 1) {
    return [0];
  }
  array = [0, 1];
  if (num === 2) {
    return array;
  }
  /* return fibonacci(num, array.push(array[i] + array[i - 1]), i + 1); */
  return getFibonacci(array, num);
};

console.log(fibonacci(100));
