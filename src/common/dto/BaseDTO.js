class BaseDTO {

    constructor(data = {}) {

        Object.assign(this, data);

    }

    static fromEntity(entity) {

        if (!entity)
            return null;

        return new this(entity);

    }

    static fromArray(entities = []) {

        return entities.map(

            entity => this.fromEntity(entity)

        );

    }

    toJSON() {

        return {

            ...this

        };

    }

}

module.exports = BaseDTO;