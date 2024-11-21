**FS Engineer Objectivo![ref1]**

Desarrollar un sistema simplificado de notificaciones en tiempo real para una tienda ficticia de comercio electrónico. El objetivo es informar a los usuarios sobre eventos relevantes, como el estado de sus pedidos. A continuación, se detalla lo que se espera implementar en cada componente:

**Backend**

**API REST:** Crear una API utilizando Node.js con Express o Next.js que incluya los siguientes puntos finales:

- **Crear una nueva notificación:** Permitir a la tienda generar notificaciones para los usuarios.
- **Marcar notificaciones como leídas:** Permitir que los usuarios actualicen el estado de una notificación.
- **Obtener notificaciones de un usuario:** Recuperar la lista completa de notificaciones de un usuario específico.

**Sistema de Colas:** Implementar un sistema de colas para gestionar las notificaciones de forma eficiente.

- Cada vez que se crea una nueva notificación, esta debe ser agregada a la cola.
- Cuando la notificación se entrega al cliente, debe eliminarse de la cola.
- Esto asegura que las notificaciones se procesen de forma asíncrona y escalable.

**Actualizaciones en Tiempo Real con Socket.io:**

- Usar WebSockets con Socket.io para enviar notificaciones en tiempo real al cliente.
- Cada vez que una nueva notificación se añade a la cola, el servidor debe notificar al cliente inmediatamente.

**Frontend**

**Aplicación ReactJS:**

- Desarrollar una interfaz de usuario utilizando ReactJS que permita a los usuarios ver y gestionar sus notificaciones.
- La lista de notificaciones debe actualizarse automáticamente en tiempo real cuando lleguen nuevas notificaciones.

**Conexión en Tiempo Real:**

- Establecer una conexión con el backend usando Socket.io para recibir notificaciones en tiempo real.
- Cada nueva notificación debe ser añadida a la lista de notificaciones del usuario sin necesidad de recargar la página.

**Funcionalidad para Marcar como Leída:**

- Permitir a los usuarios marcar una notificación como leída desde la interfaz.
- Esta acción debe enviar una actualización al backend para reflejar el cambio de estado de la notificación.

![ref1]

**Notas**

El sistema debe ser completamente funcional en una máquina local, sin necesidad de desplegarlo en la nube u otros entornos.

Nos reuniremos para una entrevista técnica en la que realizarás un recorrido detallado del sistema. En esta reunión deberás explicar la arquitectura y decisiones técnicas tomadas.

**Ejemplo de Caso de Uso**

Un cliente realiza un pedido en la tienda. A lo largo del proceso, el sistema envía notificaciones como: “Pedido Despachado.” o “Pedido Entregado.”
