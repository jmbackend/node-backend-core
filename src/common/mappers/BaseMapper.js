class BaseMapper {

    toDTO() {

        throw new Error(

            "Method toDTO() must be implemented."

        );

    }

    toEntity() {

        throw new Error(

            "Method toEntity() must be implemented."

        );

    }

    toDTOList(entities = []) {

        return entities.map(

            entity => this.toDTO(entity)

        );

    }

    toEntityList(data = []) {

        return data.map(

            item => this.toEntity(item)

        );

    }

}

module.exports = BaseMapper;