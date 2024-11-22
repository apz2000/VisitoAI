const amqp = require('amqplib');

class RabbitMQClient {
    constructor() {
        this.connection = null;
        this.channel = null;
    }

    async connect() {
        try {
            this.connection = await amqp.connect('amqp://localhost');
            this.channel = await this.connection.createChannel();
            console.log('Connected to RabbitMQ');
        } catch (error) {
            console.error('Error connecting to RabbitMQ:', error);
        }
    }

    async publishToQueue(queue, message) {
        try {
            if (!this.channel) {
                await this.connect();
            }
            await this.channel.assertQueue(queue, { durable: true });
            this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
            console.log(`Message sent to queue ${queue}`);
        } catch (error) {
            console.error('Error publishing to queue:', error);
        }
    }

    async consumeFromQueue(queue, callback) {
        try {
            if (!this.channel) {
                await this.connect();
            }
            await this.channel.assertQueue(queue, { durable: true });
            this.channel.consume(queue, (message) => {
                const content = JSON.parse(message.content.toString());
                callback(content);
                this.channel.ack(message);
            });
            console.log(`Consuming from queue ${queue}`);
        } catch (error) {
            console.error('Error consuming from queue:', error);
        }
    }
}

module.exports = new RabbitMQClient(); 