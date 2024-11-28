const amqp = require('amqplib');

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
    }

    async connect() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URL);
            this.channel = await this.connection.createChannel();
            console.log('Connected to RabbitMQ');
        } catch (error) {
            console.error('RabbitMQ connection error:', error);
            throw error;
        }
    }

    async publishToQueue(queueName, data, isDurable = true) {
        try {
            await this.channel.assertQueue(queueName, { durable: isDurable });
            return this.channel.sendToQueue(
                queueName, 
                Buffer.from(JSON.stringify(data)),
                { persistent: true }
            );
        } catch (error) {
            console.error(`Error publishing to queue ${queueName}:`, error);
            throw error;
        }
    }

    async consumeFromQueue(queueName, callback, isDurable = true) {
        try {
            await this.channel.assertQueue(queueName, { durable: isDurable });
            console.log(`Waiting for messages in ${queueName}`);
            
            this.channel.consume(queueName, (msg) => {
                if (msg !== null) {
                    const data = JSON.parse(msg.content.toString());
                    callback(data);
                    this.channel.ack(msg);
                }
            });
        } catch (error) {
            console.error(`Error consuming from queue ${queueName}:`, error);
            this.channel.nack(msg);
            throw error;
        }
    }
}

module.exports = new RabbitMQService(); 