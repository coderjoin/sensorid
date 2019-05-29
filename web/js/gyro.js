//jQuery time
var current_fs, next_fs, previous_fs; //fieldsets
var left, opacity, scale; //fieldset properties which we will animate
var animating; //flag to prevent quick multi-click glitches

var gn = new GyroNorm();
var device_model = WURFL.complete_device_name;

const BATCH_SIZE = 100;
const ROUNDING_THRESHOLD = 0.3;

var gyro_data = [[], [], []]
var sensorID = math.zeros(3, 3);

var samplingTime = .0;
var processingTime = .0;

var startTime = null;

var args = {
    frequency:3,					// ( How often the object sends the values - milliseconds )
    decimalCount:32					// ( How many digits after the decimal point will there be in the return values )
};

function setFeedback(message, has_email) {
    $('#feedback').html(message);
    $("#has-submitted-id").prop("checked", true);
    if (!has_email) {
        $('#feedback-email-div').show();
    } else {
        $('#feedback-email-div').hide();
    }
    $('#submit-btn').attr("disabled", false);
}

function startCollectSensorData() {
    gn.init(args).then(function() {
        if (gn.isAvailable(GyroNorm.ROTATION_RATE)) {

            $('#loading').css('display', 'block');

            if (startTime == null) {
                startTime = getCurrentTime();
            }

            gn.start(function(data){
                gyro_data[0].push(data.dm.alpha);
                gyro_data[1].push(data.dm.beta);
                gyro_data[2].push(data.dm.gamma);

                if (gyro_data[0].length >= BATCH_SIZE) {
                    stopCollectSensorData();
                }
            });
        } else {
            showErrorMessage();
        }
    }).catch(function(e){
        showErrorMessage();
    });
}

function showErrorMessage(error_message) {
    // console.log(error_message);
    $(".device-error").css("display","block");

}

function stopCollectSensorData() {
    gn.stop();
    $('#participate').attr("disabled", false);

    samplingTime += getCurrentTime() - startTime;
    startTime = getCurrentTime();

    const success = processData();
    processingTime += getCurrentTime() - startTime;
    startTime = null;

    gyro_data = [[], [], []];

    if (success) {
        console.log("SensorID = ", sensorID);

        setMatrix(sensorID.toArray());
        setAnalyticalTime();
        $('#loading').css('display', 'none');

        sensorID = math.zeros(3, 3);
        switchPage(0);
    } else {
        sensorID = math.zeros(3, 3);
        startCollectSensorData();
    }
}

function getCurrentTime() {
    var d = new Date();
    return d.getTime();
}

function processData() {
    const nominalGain = math.round(getNominalGain() * Math.pow(2, 16));

    if (nominalGain) {
        const a = math.round(math.multiply(diffMatrix(gyro_data), Math.pow(2, 16)));

        const e = a;

        var gainMatrix = math.multiply(math.identity(3), nominalGain);
        var cutoff = 1.0;

        const maxValue = getMaxValueInMatrix(e);
        const threshold = 1;

        while ((cutoff + 0.5) * nominalGain < maxValue) {
            const f = getSubMatrix(e, (cutoff + 0.5) * nominalGain);

            const refinedGainMatrix = refineGainMatrix(f, gainMatrix, ROUNDING_THRESHOLD);

            if (refinedGainMatrix == null) {
                cutoff = cutoff * 2;
            } else {
                gainMatrix = refinedGainMatrix;

                const powGainMatrix = gainMatrix;
                console.log("powGainMatrix = ", powGainMatrix);
                console.log("roundedMatrix = ", math.round(powGainMatrix));

                const cost = getEstimationCost(e, gainMatrix);
                console.log("cost = ", cost);

                var i;
                for (i = 0; i < 3; i++) {
                    if (cost[i] < threshold) {
                        if (math.max(math.abs(math.subtract(powGainMatrix, math.round(powGainMatrix))).toArray()[i]) < 0.01) {
                            const rounded = math.round(powGainMatrix).toArray()[i];
                            sensorID = math.subset(sensorID, math.index(i, [0, 1, 2]), rounded);
                        }
                    }
                }

                if (isSensorIDComplete()) {
                    sensorID = math.subtract(sensorID, math.multiply(math.identity(3), math.round(nominalGain)));

                    return true;
                } else {
                    cutoff = cutoff * 2;
                }

            }
        }
    } else {
        showErrorMessage();
    }

    return false;
}

function getEstimationCost(data, gainMatrix) {
    const dataMatrixScale = math.matrix(data);
    const ADCValues = math.round(math.multiply(math.inv(gainMatrix), math.matrix(data)));

    const diffMatrix = math.subtract(math.multiply(gainMatrix, ADCValues), dataMatrixScale);
    const cost = getSTD(diffMatrix);

    return cost;
}

function getSTD(matrix) {
    const A = matrix.toArray();

    return [math.std(A[0]), math.std(A[1]), math.std(A[2])];
}

function isSensorIDComplete() {
    const A = sensorID.toArray();

    if (math.deepEqual(A[0], [0, 0, 0]) || math.deepEqual(A[1], [0, 0, 0]) || math.deepEqual(A[2], [0, 0, 0])) {
        return false;
    } else {
        return true;
    }
}

function getNominalGain() {
    const gain70 = ["Apple iPad Air", "Apple iPad Air 2", "Apple iPhone 5", "Apple iPad Mini Retina"];
    const gain61 = ["Apple iPhone 6", "Apple iPhone 6 Plus", "Apple iPhone 6S", "Apple iPhone 6S Plus", "Apple iPhone 7", "Apple iPhone 7 Plus", "Apple iPhone 8", "Apple iPhone 8 Plus", "Apple iPhone SE", "Apple iPhone X", "Apple iPhone XS", "Apple iPhone XS Max"];

    // returns -1 if not exist
    if ($.inArray(device_model, gain70) != -1) {
        return 0.07;
    } else if ($.inArray(device_model, gain61) != -1) {
        return 0.061;
    } else if (device_model.startsWith("Apple iPad Pro")) {
        return 0.061;
    } else {
        return 0;
    }
}

function participate() {
    $('#participate').attr("disabled", true);

    startCollectSensorData();
}

function setMatrix(matrix) {
    setTime();

    $('#m11').html(matrix[0][0]);
    $('#m12').html(matrix[0][1]);
    $('#m13').html(matrix[0][2]);
    $('#m21').html(matrix[1][0]);
    $('#m22').html(matrix[1][1]);
    $('#m23').html(matrix[1][2]);
    $('#m31').html(matrix[2][0]);
    $('#m32').html(matrix[2][1]);
    $('#m33').html(matrix[2][2]);
}

function setTime() {
    var d = new Date(),
        seconds = d.getSeconds().toString().length == 1 ? '0'+d.getSeconds() : d.getSeconds(),
        minutes = d.getMinutes().toString().length == 1 ? '0'+d.getMinutes() : d.getMinutes(),
        hours = d.getHours().toString().length == 1 ? '0'+d.getHours() : d.getHours(),
        months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    $('#time').html(months[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear()+' '+hours+':'+minutes+':'+seconds);
}

function setAnalyticalTime() {
    $('#sampling-time').html(samplingTime / 1000.0 + 's');
    $('#processing-time').html(processingTime / 1000.0 + 's');

    samplingTime = .0;
    processingTime = .0;
}

function switchPage(idx) {
    if (animating) return false;
    animating = true;

    current_fs = $('.masthead-content').eq(idx);
    next_fs = $('.masthead-content').eq((idx + 1) % 2);

    //show the next fieldset

    //hide the current fieldset with style
    current_fs.animate({opacity: 0}, {
        duration: 300,
        complete: function(){
            current_fs.hide();
            $(window).scrollTop(0);
            next_fs.show();
            next_fs.animate({opacity: 1}, {
                duration: 300,
                complete: function(){
                    // current_fs.hide();
                    animating = false;
                },
                //this comes from the custom easing plugin
                easing: 'easeInOutBack'
            });
        },
        //this comes from the custom easing plugin
        easing: 'easeInOutBack'
    });
}
