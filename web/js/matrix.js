function substractSimilarPairs(matrix) {
    var similarMatrix = Array.from(matrix);
    var i;

    for (i = 0; i < 3; i++) {
        var m = [[], [], []];

        indexedArray = similarMatrix[i].map(function(e,i){return {ind: i, val: e}});
        // sort index/value couples, based on values
        indexedArray.sort(function(x, y){return x.val > y.val ? 1 : x.val == y.val ? 0 : -1});
        // make list keeping only indices
        indices = indexedArray.map(function(e){return e.ind});

        indices.map(function(v) {
            var j;

            for (j = 0; j < 3; j++) {
                m[j].push(similarMatrix[j][v]);
            }
        })

        similarMatrix = diffMatrix(m);
    }

    return similarMatrix;
}

function diffMatrix(matrix) {
    var m = [[], [], []];

    var i, j;
    for (i = 1; i < matrix[0].length; i++) {
        for (j = 0; j < 3; j++) {
            m[j].push(matrix[j][i] - matrix[j][i-1]);
        }
    }

    return m;
}

function combineMatrices(a, b, c, d) {
    var matrix = Array.from(a);
    var i;

    for (i = 0; i < 3; i++) {
        matrix[i] = matrix[i].concat(b[i], c[i], d[i]);
    }

    return matrix;
}

function getMaxValueInMatrix(matrix) {
    const maxRow = matrix.map(function(row){ return Math.max.apply(Math, row); });
    const max = Math.max.apply(null, maxRow);

    return max;
}

function getSubMatrix(matrix, threshold) {
    var m = [[], [], []];
    var i, j;

    for (i = 0; i < matrix[0].length; i++) {
        if (Math.abs(matrix[0][i]) < threshold && Math.abs(matrix[1][i]) < threshold && Math.abs(matrix[2][i]) < threshold) {
            for (j = 0; j < 3; j++) {
                m[j].push(matrix[j][i]);
            }
        }
    }

    return m;
}

function refineGainMatrix(data, gainMatrix, threshold) {
    const adcValues = getAdcValues(data, gainMatrix, threshold);
    const updatedGainMatrixT = solveLeastSquare(math.transpose(adcValues), math.transpose(data));

    if (!math.isNaN(updatedGainMatrixT[0][0])) {
        return math.transpose(math.matrix(updatedGainMatrixT));
    } else {
        return null;
    }
}

function getAdcValues(data, gainMatrix, threshold) {
    const ADCValues = math.multiply(math.inv(gainMatrix), math.matrix(data));
    const roundedADCValues = roundWithCare(ADCValues, threshold);

    return roundedADCValues;
}

function roundWithCare(matrix, threshold) {
    const roundedMatrix = math.round(matrix);
    var outputMatrix = math.zeros(matrix.size());
    var i;

    for (i = 0; i < matrix.size()[1]; i++) {
        const col1 = math.subset(matrix, math.index([0, 1, 2], i));
        const col2 = math.subset(roundedMatrix, math.index([0, 1, 2], i));

        const maxDiff = math.max(math.abs(math.subtract(col2, col1)));

        if (maxDiff <= threshold) {
            outputMatrix = math.subset(outputMatrix, math.index([0, 1, 2], i), col2);
        } else {
            console.log("Ambiguous rounding.");
        }
    }

    return outputMatrix;
}

function solveLeastSquare(A, b) {
    var ginvA = ginv(A);
    var x = numeric.dot(ginvA, b);

    return x;
}

var ginv = function (M) {
    // ginv with using SVD (singlar value decomposition) function
    var svd = numeric.svd(M);
    // A = U * diag(S) * t(V)
    //console.log(numeric.dot(svd.U, numeric.dot(
    //    numeric.diag(svd.S), svd.V))); // ==> A
    // ginv(A) = V * diag(1/S) * t(U)
    var diS = numeric.diag(svd.S.map(function (s) {return 1/s;}));
    var ginv = numeric.dot(svd.V, numeric.dot(diS, numeric.transpose(svd.U)));
    return ginv;
};