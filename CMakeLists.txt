cmake_minimum_required(VERSION 3.15)
project(OpenFlashCEF)

# 1. Configurar la ruta del SDK de CEF
set(CEF_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/cef")
list(APPEND CMAKE_MODULE_PATH "${CEF_ROOT}/cmake")

# 2. Encontrar e incluir el paquete oficial de CEF
find_package(CEF REQUIRED)
add_subdirectory(${CEF_ROOT} "${CMAKE_CURRENT_BINARY_DIR}/cef")

# 3. Incluir directorios de cabecera
include_directories(${CEF_ROOT})
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src_native)

# 4. Archivos de código fuente de nuestra app nativa
set(NATIVE_SOURCES
    src_native/main.cpp
    src_native/app_handler.h
    src_native/app_handler.cpp
)

# 5. Configurar ejecutable según la plataforma (Win32 GUI para evitar consola flotante en Windows)
if(WIN32)
    add_executable(${PROJECT_NAME} WIN32 ${NATIVE_SOURCES})
else()
    add_executable(${PROJECT_NAME} ${NATIVE_SOURCES})
endif()

# 6. Enlazar las librerías nativas de CEF y su wrapper de C++
target_link_libraries(${PROJECT_NAME} libcef_lib libcef_dll_wrapper)

# 7. Copiar los recursos web compilados de Spectrum 2 (carpeta dist) junto al ejecutable nativo
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    "${CMAKE_CURRENT_SOURCE_DIR}/dist"
    "$<TARGET_FILE_DIR:${PROJECT_NAME}>/resources"
)
