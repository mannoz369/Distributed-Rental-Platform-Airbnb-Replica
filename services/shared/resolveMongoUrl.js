const resolveMongoUrl = ({ env, serviceName, serviceEnvKey }) => {
  const serviceUrl = env[serviceEnvKey];

  if (serviceUrl) {
    return serviceUrl;
  }

  throw new Error(
    `${serviceName} requires ${serviceEnvKey}. Set it to a service-owned MongoDB Atlas database URL.`
  );
};

module.exports = resolveMongoUrl;
