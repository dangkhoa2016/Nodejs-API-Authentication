const winston = require ('winston');
const logFolder = process.env.LOG_FOLDER || './logs';
const fileName = process.env.LOG_FILE || 'combined.log';

/* eslint-disable-next-line no-control-regex */
const removeColor = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

const loggerConfig = winston.createLogger({
  level: 'info',  // Select the appropriate log level, can be 'debug', 'info', 'warn', 'error'
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
      ),
    }),
    new winston.transports.File({
      filename: `${logFolder}/${fileName}`,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${removeColor(message)}`),
      ),
    }),
  ],
});

module.exports = loggerConfig;
